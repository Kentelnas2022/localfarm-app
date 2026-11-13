const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
require("dotenv").config();

const dbConfig = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "localfarm",
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

let rawPool;

/**
 * Adapt SQL from PostgreSQL syntax ($1, $2, RETURNING, ILIKE) to MySQL syntax
 */
function adaptSql(sql, params = []) {
  let reorderedParams = [...params];

  // If query has $1, $2, etc., convert them to ? and align params
  const hasDollarPlaceholders = /\$(\d+)/.test(sql);
  let adaptedSql = sql;
  if (hasDollarPlaceholders) {
    const matches = [];
    adaptedSql = sql.replace(/\$(\d+)/g, (match, num) => {
      matches.push(parseInt(num, 10) - 1);
      return "?";
    });
    if (params.length > 0) {
      reorderedParams = matches.map((idx) => params[idx]);
    }
  }

  // Replace ILIKE with LIKE (MySQL is case-insensitive for utf8mb4_unicode_ci)
  adaptedSql = adaptedSql.replace(/\bILIKE\b/gi, "LIKE");

  // Adapt Postgres tagged_users subquery with json_agg for MySQL/MariaDB 10.4
  adaptedSql = adaptedSql.replace(
    /COALESCE\s*\(\s*\(\s*SELECT\s+json_agg[\s\S]*?FROM\s+tagged_users[\s\S]*?\)\s*,\s*'\[\]'::jsonb?\s*\)\s*AS\s+tagged_users/gi,
    "JSON_ARRAY() AS tagged_users"
  );

  // Adapt Postgres JSON aggregation and casts to MySQL
  adaptedSql = adaptedSql.replace(/\bjson_agg\b/gi, "JSON_ARRAYAGG");
  adaptedSql = adaptedSql.replace(/\bjson_build_object\b/gi, "JSON_OBJECT");
  adaptedSql = adaptedSql.replace(/AS\s+TEXT\b/gi, "AS CHAR");
  adaptedSql = adaptedSql.replace(/'\[\]'::jsonb?/gi, "'[]'");

  // Strip Postgres type casts like ::int, ::text, ::json, ::jsonb, ::boolean
  adaptedSql = adaptedSql.replace(/::[a-zA-Z0-9_]+/g, "");

  // Convert JSONB to JSON
  adaptedSql = adaptedSql.replace(/\bJSONB\b/gi, "JSON");

  // Adapt Postgres interval literals like INTERVAL '24 hours' or INTERVAL '5 minutes' to MySQL
  adaptedSql = adaptedSql.replace(
    /INTERVAL\s+'(\d+)\s+([a-zA-Z]+)'/gi,
    (match, count, unit) => {
      const singular = unit.toUpperCase().replace(/S$/, "");
      return `INTERVAL ${count} ${singular}`;
    },
  );

  // Handle ON CONFLICT DO NOTHING
  if (/ON\s+CONFLICT\s+DO\s+NOTHING/i.test(adaptedSql)) {
    adaptedSql = adaptedSql.replace(/\bON\s+CONFLICT\s+DO\s+NOTHING\b/gi, "");
    adaptedSql = adaptedSql.replace(/\bINSERT\s+INTO\b/gi, "INSERT IGNORE INTO");
  }

  // Check for RETURNING clause and strip it for MySQL
  const hasReturning = /RETURNING\s+([a-zA-Z0-9_*,\s]+)$/i.test(adaptedSql.trim());
  adaptedSql = adaptedSql.replace(/\s+RETURNING\s+[a-zA-Z0-9_*,\s]+$/i, "");

  return { adaptedSql, reorderedParams, hasReturning };
}

/**
 * Execute query and format result so both destructuring forms work:
 * const { rows } = await pool.query(...)
 * const [rows] = await pool.query(...)
 */
async function executeAdaptedQuery(executor, sql, params = []) {
  const { adaptedSql, reorderedParams, hasReturning } = adaptSql(sql, params);
  const [result] = await executor.query(adaptedSql, reorderedParams);

  let rows = Array.isArray(result) ? result : [];
  if (hasReturning && result && result.insertId) {
    rows = [{ id: result.insertId }];
  }

  // Dual format result: iterable as Array AND contains .rows property
  const res = rows;
  res.rows = rows;
  res.insertId = result ? result.insertId : null;
  res.rowCount = Array.isArray(result) ? result.length : (result?.affectedRows || 0);

  return res;
}

/**
 * Wrapped Pool with PostgreSQL compatibility
 */
function createWrappedPool() {
  if (!rawPool) {
    rawPool = mysql.createPool(dbConfig);
  }

  return {
    async query(sql, params = []) {
      return executeAdaptedQuery(rawPool, sql, params);
    },
    async connect() {
      const conn = await rawPool.getConnection();
      return {
        async query(sql, params = []) {
          return executeAdaptedQuery(conn, sql, params);
        },
        release() {
          conn.release();
        },
      };
    },
    end() {
      return rawPool.end();
    },
  };
}

let wrappedPool;

function getPool() {
  if (!wrappedPool) {
    wrappedPool = createWrappedPool();
  }
  return wrappedPool;
}

async function initDB() {
  try {
    const pool = getPool();
    try { await rawPool.query('SET GLOBAL max_allowed_packet = 67108864'); } catch (e) {}

    // 1. user_sessions (Device management)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`user_sessions\` (
        \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT UNSIGNED NOT NULL,
        \`device_name\` VARCHAR(150) NOT NULL,
        \`device_type\` VARCHAR(50) NOT NULL DEFAULT 'phone',
        \`os_name\` VARCHAR(50) DEFAULT NULL,
        \`os_version\` VARCHAR(50) DEFAULT NULL,
        \`browser_or_app\` VARCHAR(100) DEFAULT 'LocalFarm App',
        \`ip_address\` VARCHAR(50) DEFAULT '127.0.0.1',
        \`location\` VARCHAR(150) DEFAULT 'Iligan City, Lanao Del Norte',
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`last_active_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. blocked_users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`blocked_users\` (
        \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT UNSIGNED NOT NULL,
        \`blocked_user_id\` INT UNSIGNED NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY \`unique_user_block\` (\`user_id\`, \`blocked_user_id\`),
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`blocked_user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. user_privacy_settings
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`user_privacy_settings\` (
        \`user_id\` INT UNSIGNED PRIMARY KEY,
        \`profile_visibility\` VARCHAR(50) NOT NULL DEFAULT 'Public',
        \`post_audience\` VARCHAR(50) NOT NULL DEFAULT 'Public',
        \`story_audience\` VARCHAR(50) NOT NULL DEFAULT 'Public',
        \`tagging_permission\` VARCHAR(50) NOT NULL DEFAULT 'Everyone',
        \`connections_list_visibility\` VARCHAR(50) NOT NULL DEFAULT 'Public',
        \`pricing_visibility\` VARCHAR(50) NOT NULL DEFAULT 'Public',
        \`precise_location\` TINYINT(1) NOT NULL DEFAULT 1,
        \`map_discovery\` TINYINT(1) NOT NULL DEFAULT 1,
        \`messaging_scope\` VARCHAR(50) NOT NULL DEFAULT 'everyone',
        \`show_online_status\` TINYINT(1) NOT NULL DEFAULT 1,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. live_streams
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`live_streams\` (
        \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT UNSIGNED NOT NULL,
        \`post_id\` INT DEFAULT NULL,
        \`title\` VARCHAR(255) DEFAULT 'Live Stream',
        \`viewer_count\` INT NOT NULL DEFAULT 0,
        \`duration_seconds\` INT NOT NULL DEFAULT 0,
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'ended',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. user_conversation_settings & restricted_users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`user_conversation_settings\` (
        \`user_id\` INT UNSIGNED NOT NULL,
        \`conversation_id\` INT UNSIGNED NOT NULL,
        \`is_archived\` TINYINT(1) NOT NULL DEFAULT 0,
        \`is_spam\` TINYINT(1) NOT NULL DEFAULT 0,
        \`is_muted\` TINYINT(1) NOT NULL DEFAULT 0,
        \`is_accepted\` TINYINT(1) NOT NULL DEFAULT 0,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`user_id\`, \`conversation_id\`),
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`conversation_id\`) REFERENCES \`conversations\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`restricted_users\` (
        \`user_id\` INT UNSIGNED NOT NULL,
        \`restricted_user_id\` INT UNSIGNED NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`user_id\`, \`restricted_user_id\`),
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`restricted_user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`tagged_users\` (
        \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`post_id\` INT NOT NULL,
        \`user_id\` INT UNSIGNED NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_tagged_users_post\` (\`post_id\`),
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Safe column migrations
    const safeAddColumn = async (table, colDef) => {
      try {
        await rawPool.query(`ALTER TABLE \`${table}\` ADD COLUMN ${colDef}`);
      } catch (e) {
        // column already exists
      }
    };

    await safeAddColumn("users", "\`role_id\` INT NOT NULL DEFAULT 2");
    await safeAddColumn("users", "\`password_hash\` VARCHAR(255) DEFAULT NULL AFTER \`password\`");
    await safeAddColumn("users", "\`cover_photo_url\` LONGTEXT DEFAULT NULL");
    await safeAddColumn("users", "\`location\` VARCHAR(255) DEFAULT 'Iligan City, Philippines'");
    await safeAddColumn("users", "\`two_factor_enabled\` TINYINT(1) NOT NULL DEFAULT 0");
    await safeAddColumn("users", "\`two_factor_method\` VARCHAR(50) NOT NULL DEFAULT 'none'");
    await safeAddColumn("users", "\`two_factor_secret\` VARCHAR(255) DEFAULT NULL");
    await safeAddColumn("users", "\`eula_accepted_at\` TIMESTAMP NULL DEFAULT NULL");
    await safeAddColumn("otps", "\`is_used\` TINYINT(1) NOT NULL DEFAULT 0 AFTER \`expires_at\`");

    // Sync existing users between password and password_hash
    try {
      await rawPool.query("UPDATE users SET password_hash = password WHERE password_hash IS NULL AND password IS NOT NULL");
      await rawPool.query("UPDATE users SET password = password_hash WHERE password IS NULL AND password_hash IS NOT NULL");
    } catch (e) {}

    // Safe triggers for password and password_hash synchronization
    try {
      await rawPool.query(`
        CREATE TRIGGER IF NOT EXISTS trg_users_sync_password_insert
        BEFORE INSERT ON users
        FOR EACH ROW
        BEGIN
          IF NEW.password IS NOT NULL AND (NEW.password_hash IS NULL OR NEW.password_hash = '') THEN
            SET NEW.password_hash = NEW.password;
          ELSEIF NEW.password_hash IS NOT NULL AND (NEW.password IS NULL OR NEW.password = '') THEN
            SET NEW.password = NEW.password_hash;
          END IF;
        END
      `);
      await rawPool.query(`
        CREATE TRIGGER IF NOT EXISTS trg_users_sync_password_update
        BEFORE UPDATE ON users
        FOR EACH ROW
        BEGIN
          IF NEW.password <> OLD.password AND (NEW.password_hash = OLD.password_hash OR NEW.password_hash IS NULL) THEN
            SET NEW.password_hash = NEW.password;
          ELSEIF NEW.password_hash <> OLD.password_hash AND (NEW.password = OLD.password OR NEW.password IS NULL) THEN
            SET NEW.password = NEW.password_hash;
          END IF;
        END
      `);
    } catch (e) {}

    await safeAddColumn("farmer_profiles", "\`rsbsa_number\` VARCHAR(100) DEFAULT NULL");
    await safeAddColumn("farmer_profiles", "\`document_uri\` LONGTEXT DEFAULT NULL");

    await safeAddColumn("posts", "\`latitude\` DECIMAL(10,8) DEFAULT NULL");
    await safeAddColumn("posts", "\`longitude\` DECIMAL(11,8) DEFAULT NULL");
    await safeAddColumn("posts", "\`photos\` JSON DEFAULT NULL");
    await safeAddColumn("posts", "\`images\` JSON DEFAULT NULL AFTER \`photos\`");
    await safeAddColumn("posts", "\`tagged_user_ids\` JSON DEFAULT NULL");
    await safeAddColumn("posts", "\`expires_at\` TIMESTAMP NULL DEFAULT NULL");

    try {
      await rawPool.query("UPDATE posts SET images = photos WHERE images IS NULL AND photos IS NOT NULL");
      await rawPool.query("UPDATE posts SET photos = images WHERE photos IS NULL AND images IS NOT NULL");
    } catch (e) {}
    await safeAddColumn("posts", "\`duration_label\` VARCHAR(50) DEFAULT NULL");
    await safeAddColumn("posts", "\`is_live_replay\` TINYINT(1) NOT NULL DEFAULT 0");
    await safeAddColumn("posts", "\`viewer_count\` INT NOT NULL DEFAULT 0");
    await safeAddColumn("posts", "\`duration_seconds\` INT NOT NULL DEFAULT 0");

    await safeAddColumn("messages", "\`is_delivered\` TINYINT(1) NOT NULL DEFAULT 1");
    await safeAddColumn("reports", "\`conversation_id\` INT DEFAULT NULL");
    await safeAddColumn("reports", "\`attachment_url\` LONGTEXT DEFAULT NULL");

    // Stories migrations & dual-compatibility (expires_at vs expired_at, caption vs text_content)
    await safeAddColumn("stories", "\`expired_at\` TIMESTAMP NULL AFTER \`expires_at\`");
    await safeAddColumn("stories", "\`expires_at\` TIMESTAMP NULL AFTER \`expired_at\`");
    await safeAddColumn("stories", "\`text_content\` TEXT NULL AFTER \`media_url\`");
    await safeAddColumn("stories", "\`caption\` TEXT NULL AFTER \`text_content\`");
    await safeAddColumn("stories", "\`views_count\` INT NOT NULL DEFAULT 0");
    await safeAddColumn("stories", "\`is_featured\` TINYINT(1) NOT NULL DEFAULT 0");

    try {
      await rawPool.query("UPDATE stories SET expired_at = expires_at WHERE expired_at IS NULL AND expires_at IS NOT NULL");
      await rawPool.query("UPDATE stories SET expires_at = expired_at WHERE expires_at IS NULL AND expired_at IS NOT NULL");
      await rawPool.query("UPDATE stories SET caption = text_content WHERE (caption IS NULL OR caption = '') AND text_content IS NOT NULL");
      await rawPool.query("UPDATE stories SET text_content = caption WHERE (text_content IS NULL OR text_content = '') AND caption IS NOT NULL");
    } catch (e) {}

    try {
      await rawPool.query(`
        CREATE TRIGGER IF NOT EXISTS trg_stories_sync_insert
        BEFORE INSERT ON stories
        FOR EACH ROW
        BEGIN
          IF NEW.expires_at IS NOT NULL AND NEW.expired_at IS NULL THEN
            SET NEW.expired_at = NEW.expires_at;
          ELSEIF NEW.expired_at IS NOT NULL AND NEW.expires_at IS NULL THEN
            SET NEW.expires_at = NEW.expired_at;
          END IF;
          IF NEW.text_content IS NOT NULL AND (NEW.caption IS NULL OR NEW.caption = '') THEN
            SET NEW.caption = NEW.text_content;
          ELSEIF NEW.caption IS NOT NULL AND (NEW.text_content IS NULL OR NEW.text_content = '') THEN
            SET NEW.text_content = NEW.caption;
          END IF;
        END
      `);
      await rawPool.query(`
        CREATE TRIGGER IF NOT EXISTS trg_stories_sync_update
        BEFORE UPDATE ON stories
        FOR EACH ROW
        BEGIN
          IF NEW.expires_at <> OLD.expires_at AND (NEW.expired_at = OLD.expired_at OR NEW.expired_at IS NULL) THEN
            SET NEW.expired_at = NEW.expires_at;
          ELSEIF NEW.expired_at <> OLD.expired_at AND (NEW.expires_at = OLD.expires_at OR NEW.expires_at IS NULL) THEN
            SET NEW.expires_at = NEW.expired_at;
          END IF;
          IF NEW.text_content <> OLD.text_content AND (NEW.caption = OLD.caption OR NEW.caption IS NULL) THEN
            SET NEW.caption = NEW.text_content;
          ELSEIF NEW.caption <> OLD.caption AND (NEW.text_content = OLD.text_content OR NEW.text_content IS NULL) THEN
            SET NEW.text_content = NEW.caption;
          END IF;
        END
      `);
    } catch (e) {}

    console.log(`[MySQL] Connected successfully to database: ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`);
  } catch (err) {
    console.error("[MySQL] Connection error:", err.message);
  }
}

module.exports = {
  initDB,
  getPool,
};
