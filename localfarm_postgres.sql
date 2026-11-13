-- =============================================================================
-- LOCAL FARM APP - POSTGRESQL DATABASE SCHEMA
-- Database: local-farm
-- Server: 127.0.0.1:5432
-- Matches Miro ERD: Roles, Users, Posts, Stories, Streams, Chats, Notifications
-- =============================================================================

-- 0. Drop existing tables in reverse dependency order
DROP TABLE IF EXISTS tagged_users CASCADE;
DROP TABLE IF EXISTS comment_likes CASCADE;
DROP TABLE IF EXISTS post_comments CASCADE;
DROP TABLE IF EXISTS post_likes CASCADE;
DROP TABLE IF EXISTS post_shares CASCADE;
DROP TABLE IF EXISTS saved_posts CASCADE;
DROP TABLE IF EXISTS posts CASCADE;

DROP TABLE IF EXISTS story_reactions CASCADE;
DROP TABLE IF EXISTS story_views CASCADE;
DROP TABLE IF EXISTS stories CASCADE;

DROP TABLE IF EXISTS live_streams CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS chats CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS connections CASCADE;
DROP TABLE IF EXISTS otps CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- -----------------------------------------------------------------------------
-- 1. Roles Table
-- -----------------------------------------------------------------------------
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT
);

INSERT INTO roles (id, name, description) VALUES
  (1, 'admin', 'System Administrator with full management access'),
  (2, 'user', 'Regular app user (farmer or customer)')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. Users Table
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  role_id INT REFERENCES roles(id) ON DELETE SET NULL DEFAULT 2,
  username VARCHAR(100) UNIQUE,
  email VARCHAR(191) NOT NULL UNIQUE,
  phone_number VARCHAR(50),
  gender VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  location VARCHAR(255) DEFAULT 'Iligan City, Philippines',
  eula_accepted_at TIMESTAMP,
  preference JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 3. OTPs Table (Verification codes for signup & password resets)
-- -----------------------------------------------------------------------------
CREATE TABLE otps (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(191) NOT NULL,
  otp VARCHAR(10) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'signup',
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

-- -----------------------------------------------------------------------------
-- 4. Connections Table (Friendships & Farmer Network)
-- -----------------------------------------------------------------------------
CREATE TABLE connections (
  id SERIAL PRIMARY KEY,
  sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  collection_name VARCHAR(100) NOT NULL DEFAULT 'All Connections',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_connection UNIQUE (sender_id, receiver_id)
);

-- -----------------------------------------------------------------------------
-- 5. Conversations & Messages (Chat system)
-- -----------------------------------------------------------------------------
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  user1_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message TEXT,
  last_message_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_conversation_pair UNIQUE (user1_id, user2_id)
);

CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  message_type VARCHAR(20) NOT NULL DEFAULT 'text',
  image_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chats (
  id SERIAL PRIMARY KEY,
  conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  is_muted BOOLEAN NOT NULL DEFAULT FALSE,
  last_read_message_id INT REFERENCES messages(id) ON DELETE SET NULL,
  CONSTRAINT unique_user_chat UNIQUE (conversation_id, user_id)
);

-- -----------------------------------------------------------------------------
-- 6. Posts (Community Feed & Produce Listings)
-- -----------------------------------------------------------------------------
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_post_id INT REFERENCES posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  category VARCHAR(50) NOT NULL DEFAULT 'General',
  privacy VARCHAR(50) NOT NULL DEFAULT 'Public',
  location VARCHAR(255) DEFAULT 'Iligan City, Philippines',
  likes_count INT NOT NULL DEFAULT 0,
  comments_count INT NOT NULL DEFAULT 0,
  shares_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tagged_users (
  id SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT unique_post_tag UNIQUE (post_id, user_id)
);

CREATE TABLE post_likes (
  id SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_post_like UNIQUE (post_id, user_id)
);

CREATE TABLE post_comments (
  id SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id INT REFERENCES post_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  likes_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE comment_likes (
  id SERIAL PRIMARY KEY,
  comment_id INT NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_comment_like UNIQUE (comment_id, user_id)
);

CREATE TABLE post_shares (
  id SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_type VARCHAR(50) NOT NULL DEFAULT 'public',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE saved_posts (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  collection_name VARCHAR(100) NOT NULL DEFAULT 'All Saved',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_saved_post UNIQUE (user_id, post_id)
);

-- -----------------------------------------------------------------------------
-- 7. Stories (24-hour visual updates)
-- -----------------------------------------------------------------------------
CREATE TABLE stories (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_type VARCHAR(20) NOT NULL DEFAULT 'image',
  media_url TEXT,
  text_content TEXT,
  background_color VARCHAR(20),
  music_title VARCHAR(150),
  privacy VARCHAR(50) NOT NULL DEFAULT 'Public',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expired_at TIMESTAMP NOT NULL
);

CREATE TABLE story_views (
  id SERIAL PRIMARY KEY,
  story_id INT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  view_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_story_view UNIQUE (story_id, viewer_id)
);

CREATE TABLE story_reactions (
  id SERIAL PRIMARY KEY,
  story_id INT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_type VARCHAR(50) NOT NULL DEFAULT 'like',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 8. Live Streams
-- -----------------------------------------------------------------------------
CREATE TABLE live_streams (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INT REFERENCES posts(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'live',
  viewer_count INT NOT NULL DEFAULT 0,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 9. Notifications
-- -----------------------------------------------------------------------------
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id INT REFERENCES users(id) ON DELETE SET NULL,
  actor_type VARCHAR(50) DEFAULT 'user',
  type VARCHAR(50) NOT NULL,
  title VARCHAR(150),
  content TEXT NOT NULL,
  entity_name VARCHAR(50),
  target_id INT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 10. Reports (Moderation)
-- -----------------------------------------------------------------------------
CREATE TABLE reports (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(50) NOT NULL DEFAULT 'post',
  target_id INT,
  reason VARCHAR(150) NOT NULL,
  statement TEXT,
  attachment TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 11. Initial Seed Data (Admin: admin123)
-- -----------------------------------------------------------------------------
INSERT INTO users (first_name, last_name, role_id, role, username, email, password_hash, location, eula_accepted_at)
VALUES
  ('Admin', 'User', 1, 'admin', 'admin', 'admin@localfarm.com', '$2b$10$IzKOqtj9dpTiAXv3lOTWbOzj3W7ECOQ7BDLphbbkMi3R1uRFEutYO', 'Iligan City, Philippines', NOW())
ON CONFLICT (email) DO NOTHING;
