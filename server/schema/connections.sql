-- Connections table with collection_name for categorizing friends
CREATE TABLE IF NOT EXISTS `connections` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sender_id` INT NOT NULL,
  `receiver_id` INT NOT NULL,
  `status` ENUM('pending', 'accepted', 'declined', 'blocked') NOT NULL DEFAULT 'pending',
  `collection_name` VARCHAR(100) NOT NULL DEFAULT 'All Connections',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`receiver_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_connection` (`sender_id`, `receiver_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration for existing tables: add collection_name column if missing
ALTER TABLE `connections`
ADD COLUMN IF NOT EXISTS `collection_name` VARCHAR(100) NOT NULL DEFAULT 'All Connections' AFTER `status`;
