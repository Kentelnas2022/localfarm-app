-- ==============================================================================
-- LOCAL FARM APP - MYSQL DATABASE SCHEMA
-- Database: localfarm
-- Server: 127.0.0.1
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS `localfarm` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `localfarm`;

-- ------------------------------------------------------------------------------
-- 1. Table structure for table `users`
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `first_name` VARCHAR(100) DEFAULT NULL,
  `last_name` VARCHAR(100) DEFAULT NULL,
  `full_name` VARCHAR(200) DEFAULT NULL,
  `username` VARCHAR(100) UNIQUE DEFAULT NULL,
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `phone_number` VARCHAR(50) DEFAULT NULL,
  `gender` ENUM('Male', 'Female', 'Other') DEFAULT NULL,
  `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  `avatar_url` LONGTEXT DEFAULT NULL,
  `bio` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 2. Table structure for table `otps` (Password resets and verification)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `otps` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(191) NOT NULL,
  `otp` VARCHAR(10) NOT NULL,
  `type` ENUM('signup', 'recovery') NOT NULL DEFAULT 'signup',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 3. Table structure for table `connections` (Friend requests & connections)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `connections` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sender_id` INT NOT NULL,
  `receiver_id` INT NOT NULL,
  `status` ENUM('pending', 'accepted', 'declined', 'blocked') NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`receiver_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_connection` (`sender_id`, `receiver_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 4. Table structure for table `conversations` (Chat thread channels)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `conversations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user1_id` INT NOT NULL,
  `user2_id` INT NOT NULL,
  `last_message` TEXT DEFAULT NULL,
  `last_message_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user1_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user2_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_pair` (`user1_id`, `user2_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 5. Table structure for table `messages` (Chat messages)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `messages` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `conversation_id` INT NOT NULL,
  `sender_id` INT NOT NULL,
  `receiver_id` INT NOT NULL,
  `message_text` LONGTEXT NOT NULL,
  `message_type` ENUM('text', 'image', 'file') NOT NULL DEFAULT 'text',
  `image_url` LONGTEXT DEFAULT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`receiver_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 6. Table structure for table `posts` (News feed community posts)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `posts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `original_post_id` INT DEFAULT NULL,
  `content` LONGTEXT NOT NULL,
  `image_url` LONGTEXT DEFAULT NULL,
  `category` ENUM('Field', 'Wholesaler', 'Temporary', 'General') NOT NULL DEFAULT 'General',
  `privacy` ENUM('Public', 'Friends', 'Only me') NOT NULL DEFAULT 'Public',
  `location` VARCHAR(255) DEFAULT 'Iligan City, Philippines',
  `is_pre_harvest` TINYINT(1) NOT NULL DEFAULT 0,
  `crop_name` VARCHAR(150) DEFAULT NULL,
  `unit` VARCHAR(50) DEFAULT 'kg',
  `price_per_unit` DECIMAL(10,2) DEFAULT NULL,
  `available_quantity` DECIMAL(10,2) DEFAULT NULL,
  `reserved_quantity` DECIMAL(10,2) DEFAULT 0,
  `expected_harvest_date` DATE DEFAULT NULL,
  `pickup_hub` VARCHAR(255) DEFAULT NULL,
  `likes_count` INT NOT NULL DEFAULT 0,
  `comments_count` INT NOT NULL DEFAULT 0,
  `shares_count` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`original_post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 7. Table structure for table `post_likes` (Likes tracking)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `post_likes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `post_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_like` (`post_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 8. Table structure for table `post_comments` (Comments and replies)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `post_comments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `post_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `parent_id` INT DEFAULT NULL,
  `content` TEXT NOT NULL,
  `likes_count` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`parent_id`) REFERENCES `post_comments`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 9. Table structure for table `comment_likes` (Comment likes tracking)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `comment_likes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `comment_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`comment_id`) REFERENCES `post_comments`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_comment_like` (`comment_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 10. Table structure for table `post_shares` (Share analytics)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `post_shares` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `post_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `share_type` VARCHAR(50) NOT NULL DEFAULT 'public',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 11. Table structure for table `saved_posts` (Bookmarked / Saved posts)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `saved_posts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `post_id` INT NOT NULL,
  `collection_name` VARCHAR(100) NOT NULL DEFAULT 'All Saved',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_user_saved_post` (`user_id`, `post_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 12. Table structure for table `farmer_profiles` (RSBSA & Farm Registry)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `farmer_profiles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL UNIQUE,
  `farmer_code` VARCHAR(50) NOT NULL,
  `rsbsa_number` VARCHAR(100) NOT NULL,
  `farm_name` VARCHAR(200) NOT NULL,
  `crops` TEXT NOT NULL,
  `farm_location` VARCHAR(255) NOT NULL,
  `document_uri` LONGTEXT DEFAULT NULL,
  `verification_status` ENUM('pending', 'verified', 'rejected') NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 13. Table structure for table `notifications` (User alerts and booking notifications)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `actor_id` INT DEFAULT NULL,
  `type` VARCHAR(50) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `reference_id` INT DEFAULT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 14. Table structure for table `harvest_reservations` (Pre-Harvest Advance Bookings)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `harvest_reservations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `reservation_code` VARCHAR(50) NOT NULL UNIQUE,
  `post_id` INT NOT NULL,
  `seller_id` INT NOT NULL,
  `buyer_id` INT NOT NULL,
  `crop_name` VARCHAR(150) NOT NULL,
  `quantity` DECIMAL(10,2) NOT NULL,
  `unit` VARCHAR(50) NOT NULL DEFAULT 'kg',
  `price_per_unit` DECIMAL(10,2) NOT NULL,
  `total_estimated_amount` DECIMAL(10,2) NOT NULL,
  `actual_weighed_quantity` DECIMAL(10,2) DEFAULT NULL,
  `final_settled_amount` DECIMAL(10,2) DEFAULT NULL,
  `harvest_date` DATE NOT NULL,
  `pickup_location` VARCHAR(255) NOT NULL,
  `status` ENUM('pending', 'confirmed', 'ready_for_pickup', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  `qr_token` VARCHAR(100) NOT NULL,
  `buyer_notes` TEXT DEFAULT NULL,
  `seller_notes` TEXT DEFAULT NULL,
  `weighed_at` DATETIME DEFAULT NULL,
  `completed_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_seller_status` (`seller_id`, `status`),
  INDEX `idx_buyer_status` (`buyer_id`, `status`),
  INDEX `idx_post_id` (`post_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 15. Initial Sample Seed Data (Password: admin123 / farmer123)
-- ------------------------------------------------------------------------------
INSERT INTO `users` (`first_name`, `last_name`, `full_name`, `username`, `email`, `password`, `phone_number`, `gender`, `role`)
VALUES
  ('Admin', 'User', 'Admin User', 'admin', 'admin@localfarm.com', '$2b$10$w3U6Uf432/m6ZzYw1Z5mdeC5G1xM44m7Pz2Gq0qF1nB0kUqT5eL9O', '09123456789', 'Male', 'admin'),
  ('Maria', 'Santos', 'Maria Santos', 'mariasantos', 'maria@localfarm.com', '$2b$10$w3U6Uf432/m6ZzYw1Z5mdeC5G1xM44m7Pz2Gq0qF1nB0kUqT5eL9O', '09171234567', 'Female', 'user'),
  ('Farmer', 'John', 'Farmer John', 'farmerjohn', 'farmer@localfarm.com', '$2b$10$w3U6Uf432/m6ZzYw1Z5mdeC5G1xM44m7Pz2Gq0qF1nB0kUqT5eL9O', '09987654321', 'Male', 'user'),
  ('Mark Paul', 'Cosido', 'Mark Paul Cosido', 'markpaul', 'markpaul@localfarm.com', '$2b$10$w3U6Uf432/m6ZzYw1Z5mdeC5G1xM44m7Pz2Gq0qF1nB0kUqT5eL9O', '09112233445', 'Male', 'user'),
  ('Fritz', 'Subrabas', 'Fritz Subrabas', 'fritz', 'fritz@localfarm.com', '$2b$10$w3U6Uf432/m6ZzYw1Z5mdeC5G1xM44m7Pz2Gq0qF1nB0kUqT5eL9O', '09223344556', 'Male', 'user'),
  ('Noel', 'Garcia', 'Noel Garcia', 'noel', 'noel@localfarm.com', '$2b$10$w3U6Uf432/m6ZzYw1Z5mdeC5G1xM44m7Pz2Gq0qF1nB0kUqT5eL9O', '09334455667', 'Male', 'user')
ON DUPLICATE KEY UPDATE `id` = `id`;

-- Sample Pre-Harvest Produce Post (Matches Image 1)
INSERT INTO `posts` (`id`, `user_id`, `content`, `category`, `privacy`, `location`, `is_pre_harvest`, `crop_name`, `unit`, `price_per_unit`, `available_quantity`, `reserved_quantity`, `expected_harvest_date`, `pickup_hub`, `created_at`)
VALUES
  (101, 2, 'Crisp romaine and organic butterhead lettuce harvested early dawn! Grown with natural spring water, zero synthetic chemical sprays. Available for same-day delivery.', 'Field', 'Public', 'Northern Valley, Benguet', 1, 'Sweet Yellow Corn', 'kg', 35.00, 150.00, 45.00, '2026-10-26', 'Northern Valley Central Market Hub', NOW())
ON DUPLICATE KEY UPDATE `id` = `id`;

-- Sample Customer Reservations (Buyers reserving the produce above)
INSERT INTO `harvest_reservations` (`reservation_code`, `post_id`, `seller_id`, `buyer_id`, `crop_name`, `quantity`, `unit`, `price_per_unit`, `total_estimated_amount`, `harvest_date`, `pickup_location`, `status`, `qr_token`, `buyer_notes`, `created_at`)
VALUES
  ('LF-RES-4521', 101, 2, 4, 'Sweet Yellow Corn', 25.00, 'kg', 35.00, 875.00, '2026-10-26', 'Northern Valley Central Market Hub', 'confirmed', 'QR_LF_4521_SAMPLE', 'Please reserve in sturdy ventilated crates, will pick up 8:00 AM.', NOW() - INTERVAL 2 DAY),
  ('LF-RES-8824', 101, 2, 6, 'Sweet Yellow Corn', 20.00, 'kg', 35.00, 700.00, '2026-10-26', 'Northern Valley Central Market Hub', 'pending', 'QR_LF_8824_SAMPLE', 'For retail store batch, please confirm availability.', NOW() - INTERVAL 4 HOUR)
ON DUPLICATE KEY UPDATE `reservation_code` = `reservation_code`;
