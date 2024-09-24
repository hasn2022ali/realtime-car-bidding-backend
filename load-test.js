const WebSocket = require("ws");
const os = require("os");

const MAX_CONNECTIONS = 35000;
const INITIAL_CONNECTIONS_PER_SECOND = 100;
const MAX_CONNECTIONS_PER_SECOND = 1000;
const RAMP_UP_INTERVAL = 5000; // 5 seconds
const SERVER_URL = "ws://localhost:8080";

let activeConnections = 0;
let failedConnections = 0;
let connectionsMade = 0;
let connectionsPerSecond = INITIAL_CONNECTIONS_PER_SECOND;
const startTime = Date.now();

const connectionPool = new Set();

function createConnection(id) {
  const ws = new WebSocket(SERVER_URL);
  ws.on("open", () => {
    activeConnections++;
    connectionPool.add(ws);
    if (id % 100 === 0) {
      console.log(`Connection ${id} established. Active: ${activeConnections}`);
    }
  });
  ws.on("error", (error) => {
    failedConnections++;
    console.error(`Connection ${id} error:`, error.message);
  });
  ws.on("close", () => {
    activeConnections--;
    connectionPool.delete(ws);
  });
}

function reportStats() {
  const uptime = (Date.now() - startTime) / 1000;
  console.log(`
    Uptime: ${uptime.toFixed(2)} seconds
    Active Connections: ${activeConnections}
    Failed Connections: ${failedConnections}
    Current Rate: ${connectionsPerSecond} connections/second
    CPU Usage: ${os.loadavg()[0].toFixed(2)}
    Memory Usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(
      2
    )} MB
    File Descriptors: ${(activeConnections + 10).toString()} / ${
    os.constants.UV_THREADPOOL_SIZE
  }
  `);
}

function rampUpConnections() {
  if (connectionsPerSecond < MAX_CONNECTIONS_PER_SECOND) {
    connectionsPerSecond = Math.min(
      connectionsPerSecond + 100,
      MAX_CONNECTIONS_PER_SECOND
    );
    console.log(`Ramped up to ${connectionsPerSecond} connections/second`);
  }
}

const connectionInterval = setInterval(() => {
  for (let i = 0; i < connectionsPerSecond; i++) {
    if (connectionsMade < MAX_CONNECTIONS) {
      createConnection(connectionsMade);
      connectionsMade++;
    } else {
      clearInterval(connectionInterval);
      console.log("Finished creating connections");
      break;
    }
  }

  // Close old connections if we're at the limit
  while (connectionPool.size > MAX_CONNECTIONS) {
    const oldestConnection = connectionPool.values().next().value;
    oldestConnection.close();
  }
}, 1000);

setInterval(reportStats, 5000);
setInterval(rampUpConnections, RAMP_UP_INTERVAL);
