// server.js
const WebSocket = require("ws");
const http = require("http");
const mysql = require("mysql2/promise");
const Redis = require("ioredis");
const cors = require("cors");
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { inspect } = require("util");
const cluster = require("cluster");
const os = require("os");
require("events").EventEmitter.defaultMaxListeners = 100000;

const numCPUs = os.cpus().length;

// if (cluster.isMaster) {
//   console.log(`Master process ${process.pid} is running`);
//   console.log(`num of CPUs: ${numCPUs}`);
//   for (let i = 0; i < numCPUs; i++) {
//     cluster.fork();
//   }

//   cluster.on("exit", (worker, code, signal) => {
//     console.log(`Worker process ${worker.process.pid} died. Restarting...`);
//     cluster.fork();
//   });
// } else {
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const JWT_SECRET =
  "a568d2487a96dbef63607f83d86281843abb6b2c5f4ca73c6c222d52554aae24";
// MySQL connection
const dbPool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "auction",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Redis client
const redis = new Redis({
  host: "localhost",
  port: 6379,
});

const subscriptions = new Map();
const authenticatedClients = new WeakMap();
let activeConnections = new Set();

wss.on("connection", (ws) => {
  //   console.log(ws);
  activeConnections.add(ws);

  console.log("Client connected:", activeConnections.size);

  ws.on("message", async (message) => {
    const data = JSON.parse(message);

    switch (data.type) {
      case "AUTHENTICATE":
        try {
          const decoded = jwt.verify(data.token, JWT_SECRET);
          console.log("the authenticated user is : ", decoded);
          authenticatedClients.set(ws, { userId: decoded.id });
          ws.send(JSON.stringify({ type: "AUTHENTICATED" }));
        } catch (err) {
          ws.send(
            JSON.stringify({ type: "AUTH_ERROR", message: "Invalid token" })
          );
        }
        break;

      case "SUBSCRIBE":
        if (!authenticatedClients.has(ws)) {
          ws.send(
            JSON.stringify({ type: "ERROR", message: "Not authenticated" })
          );
          return;
        }
        if (!subscriptions.has(data.auctionId)) {
          subscriptions.set(data.auctionId, new Set());
        }
        subscriptions.get(data.auctionId).add(ws);
        ws.send(
          JSON.stringify({ type: "SUBSCRIBED", auctionId: data.auctionId })
        );
        break;

      case "UNSUBSCRIBE":
        if (subscriptions.has(data.auctionId)) {
          subscriptions.get(data.auctionId).delete(ws);
        }
        ws.send(
          JSON.stringify({ type: "UNSUBSCRIBED", auctionId: data.auctionId })
        );
        break;
      case "CREATE_AUCTION":
        await createAuction(data.carId, data.startingPrice);
        break;
      case "AUCTION_STATUSES_GET":
        await getAuctionStatuses(data.auctionId, ws);
        break;
      case "PLACE_BID":
        // console.log(
        //   "weak",
        //   inspect(authenticatedClients, { showHidden: true })
        // );
        if (!authenticatedClients.has(ws)) {
          ws.send(
            JSON.stringify({ type: "ERROR", message: "Not authenticated" })
          );
          return;
        }
        const { userId } = authenticatedClients.get(ws);
        console.log("placing new BID", userId);
        await placeBid(data.auctionId, data.amount, userId, ws);
        break;
      case "GET_AUCTION_STATUS":
        await sendAuctionStatus(data.carId, ws);
        break;
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    activeConnections.delete(ws);

    subscriptions.forEach((clients, auctionId) => {
      clients.delete(ws);
      if (clients.size === 0) {
        subscriptions.delete(auctionId);
      }
    });
    authenticatedClients.delete(ws);
  });
});

async function createAuction(carId, startingPrice) {
  const connection = await dbPool.getConnection();
  try {
    await connection.query(
      "INSERT INTO auctions (car_id, highest_bid, highest_bidder) VALUES (?, ?, NULL)",
      [carId, startingPrice]
    );
    await redis.set(
      `auction:${carId}`,
      JSON.stringify({ highestBid: startingPrice, highestBidder: null })
    );
    await broadcastAuctionStatus(carId);
  } catch (error) {
    console.error("Error creating auction:", error);
  } finally {
    connection.release();
  }
}

async function placeBid(auctionId, amount, bidderId, ws) {
  console.log("bidder id", bidderId);
  console.log("auctionId id", auctionId);
  console.log("amount", amount);
  const connection = await dbPool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT * FROM auctions WHERE id = ? FOR UPDATE",
      [auctionId]
    );
    const auction = rows[0];
    if (!auction) {
      ws.send(
        JSON.stringify({
          type: "PLACE_BID_ERROR",
          message: "Auction not found",
        })
      );
      return;
    }
    const now = new Date();
    if (
      now <= new Date(auction.start_date) ||
      now >= new Date(auction.end_date)
    ) {
      ws.send(
        JSON.stringify({
          type: "PLACE_BID_ERROR",
          message: "Auction is not active",
        })
      );
      return;
    }
    console.log("highest BID: ", auction.highest_bid);

    if (auction && amount > auction.highest_bid) {
      console.log("new bid is high");
      await connection.query(
        "UPDATE auctions SET highest_bid = ?, highest_bidder = ? WHERE id = ?",
        [amount, bidderId, auctionId]
      );
      await connection.commit();
      // insert new bid into user_bids
      await connection.query(
        "INSERT INTO user_bids (user_id, auction_id, amount) VALUES (?,?,?)",
        [bidderId, auctionId, amount]
      );
      await redis.set(
        `auction:${auctionId}`,
        JSON.stringify({ highestBid: amount, highestBidder: bidderId })
      );
      await broadcastAuctionStatus(auctionId);
    } else {
      console.log("the amount is small");
      await connection.rollback();
    }
  } catch (error) {
    await connection.rollback();
    console.error("Error placing bid:", error);
  } finally {
    connection.release();
  }
}

async function getAuctionStatuses(carId, ws) {
  const connection = await dbPool.getConnection();
  const [rows] = await connection.query(
    "SELECT auction_id as auctionId, amount as highestBid FROM user_bids WHERE auction_id = ? order by id desc limit 10",
    [carId]
  );

  ws.send(
    JSON.stringify({
      type: "AUCTION_STATUSES",
      rows,
    })
  );
}
async function sendAuctionStatus(carId, ws) {
  try {
    const auctionData = await redis.get(`auction:${carId}`);
    if (auctionData) {
      const auction = JSON.parse(auctionData);
      ws.send(
        JSON.stringify({
          type: "AUCTION_STATUS",
          carId,
          highestBid: auction.highestBid,
        })
      );
    }
  } catch (error) {
    console.error("Error sending auction status:", error);
  }
}

async function broadcastAuctionStatus(carId) {
  try {
    const auctionData = await redis.get(`auction:${carId}`);
    console.log("getting auction details:", auctionData);
    if (auctionData) {
      const auction = JSON.parse(auctionData);
      const message = JSON.stringify({
        type: "AUCTION_STATUS",
        carId,
        highestBid: auction.highestBid,
      });
      subscriptions.get(carId).forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
      //   wss.clients.forEach((client) => {
      //     if (client.readyState === WebSocket.OPEN) {
      //       client.send();
      //     }
      //   });
    }
  } catch (error) {
    console.error("Error broadcasting auction status:", error);
  }
}

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

app.get("/", (req, res) => {
  res.send("WebSocket server is running");
});

app.post("/api/auctions", authenticateToken, async (req, res) => {
  const { carId, startingPrice, auctionStart, auctionEnd } = req.body;
  // const decoded = jwt.verify(data.token, JWT_SECRET);
  // console.log("req", req.user);
  let userId = req.user.id;
  if (!carId || !userId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const connection = await dbPool.getConnection();

  try {
    await connection.query(
      "INSERT INTO auctions (user_id, car_id, starting_price,start_date, end_date ) VALUES (?,?,?,?,?)",
      [userId, carId, startingPrice, auctionStart, auctionEnd]
    );
    await redis.set(
      `auction:${carId}`,
      JSON.stringify({ highestBid: startingPrice, highestBidder: null })
    );

    //   await broadcastAuctionStatus(carId);
    res.status(201).json({ message: "Auction created successfully" });
  } catch (error) {
    console.error("Error creating auction:", error);
    res.status(500).json({ error: "Failed to create auction" });
  } finally {
    connection.release();
  }
});
app.get("/api/auctions", authenticateToken, async (req, res) => {
  const connection = await dbPool.getConnection();
  try {
    const [rows] = await connection.query(
      "SELECT * FROM auctions ORDER BY id DESC"
    );
    res.status(201).json({ message: "fetched", data: rows });
  } catch (error) {
    console.error("Error fetching auctions:", error);
    res.status(500).json({ error: "Failed to fetch auctions" });
  } finally {
    connection.release();
  }
});

app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const connection = await dbPool.getConnection();
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await connection.query(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      [username, hashedPassword]
    );
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ error: "Failed to register user" });
  } finally {
    connection.release();
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const connection = await dbPool.getConnection();
  try {
    const [rows] = await connection.query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );
    const user = rows[0];

    if (user && (await bcrypt.compare(password, user.password))) {
      const token = jwt.sign(
        { id: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: "1h" }
      );
      res.json({ token });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ error: "Failed to log in" });
  } finally {
    connection.release();
  }
});
// app.get("/auctions", (req, res) => { });

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`WebSocket server is running on port ${PORT}`);
});
app.listen(3005, () => {
  console.log(`requests on ${3005}`);
});
// }
