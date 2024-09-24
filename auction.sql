-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Sep 24, 2024 at 02:11 PM
-- Server version: 10.4.28-MariaDB
-- PHP Version: 8.2.4

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `auction`
--

-- --------------------------------------------------------

--
-- Table structure for table `auctions`
--

CREATE TABLE `auctions` (
  `user_id` bigint(20) NOT NULL,
  `starting_price` int(11) DEFAULT NULL,
  `start_date` timestamp NULL DEFAULT NULL,
  `end_date` timestamp NULL DEFAULT NULL,
  `highest_bid` decimal(10,2) DEFAULT NULL,
  `highest_bidder` varchar(255) DEFAULT NULL,
  `id` bigint(20) UNSIGNED NOT NULL,
  `car_id` varchar(200) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `auctions`
--

INSERT INTO `auctions` (`user_id`, `starting_price`, `start_date`, `end_date`, `highest_bid`, `highest_bidder`, `id`, `car_id`) VALUES
(1, 12, '2024-09-23 13:53:00', '2024-09-23 13:54:00', NULL, NULL, 1, '1122'),
(1, 11, '2024-09-23 13:55:00', '2024-09-23 13:57:00', 17.00, '2', 2, '1123'),
(2, 10, '2024-09-23 14:31:00', '2024-09-23 14:37:00', 28.00, '2', 3, '222'),
(2, 10, '2024-09-23 14:32:00', '2024-09-23 14:41:00', NULL, NULL, 4, '111'),
(2, 10, '2024-09-23 14:33:00', '2024-09-23 14:33:00', NULL, NULL, 5, '1121'),
(2, 10, '2024-09-24 10:46:00', '2024-09-27 10:46:00', 12.00, '2', 8, '555');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(255) NOT NULL,
  `password` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `password`, `created_at`) VALUES
(1, 'ali', '$2b$10$COcx4RZ76lC1AMWpnaaSiuvCjxBh470S8bq8UxwLtsKlOnGywXbZ2', '2024-09-23 13:25:05'),
(2, 'user', '$2b$10$67yZvDv/nB5U.YTIoBm0t.qDuRx5UNOpSSsCpCTjudVtg3CfDgvKu', '2024-09-23 14:31:51'),
(3, 'user1', '$2b$10$VETudyPOtj.N4PSEfUR/VudeeyIvfbMccYO2I1Zoo/vDPOpoyzXU6', '2024-09-24 09:15:32');

-- --------------------------------------------------------

--
-- Table structure for table `user_bids`
--

CREATE TABLE `user_bids` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) DEFAULT NULL,
  `auction_id` bigint(20) DEFAULT NULL,
  `amount` double DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_bids`
--

INSERT INTO `user_bids` (`id`, `user_id`, `auction_id`, `amount`, `created_at`) VALUES
(1, 2, 3, 12, '2024-09-24 09:14:55'),
(2, 2, 3, 13, '2024-09-24 09:14:59'),
(3, 2, 3, 14, '2024-09-24 09:15:02'),
(4, 3, 3, 15, '2024-09-24 09:15:55'),
(5, 2, 3, 16, '2024-09-24 09:34:23'),
(6, 3, 3, 17, '2024-09-24 09:39:59'),
(7, 2, 2, 16, '2024-09-24 09:41:16'),
(8, 2, 2, 17, '2024-09-24 09:41:24'),
(9, 2, 3, 18, '2024-09-24 10:10:02'),
(10, 2, 3, 19, '2024-09-24 10:10:07'),
(11, 2, 3, 20, '2024-09-24 10:10:12'),
(12, 2, 3, 21, '2024-09-24 10:10:14'),
(13, 2, 3, 22, '2024-09-24 10:10:16'),
(14, 2, 3, 23, '2024-09-24 10:10:19'),
(15, 2, 3, 24, '2024-09-24 10:10:23'),
(16, 2, 3, 25, '2024-09-24 10:10:26'),
(17, 2, 3, 26, '2024-09-24 10:10:29'),
(18, 2, 3, 27, '2024-09-24 10:10:31'),
(19, 2, 3, 28, '2024-09-24 10:10:35'),
(20, 2, 8, 12, '2024-09-24 10:46:49');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `auctions`
--
ALTER TABLE `auctions`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- Indexes for table `user_bids`
--
ALTER TABLE `user_bids`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `auctions`
--
ALTER TABLE `auctions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `user_bids`
--
ALTER TABLE `user_bids`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
