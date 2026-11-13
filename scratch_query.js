const mysql = require("./server/node_modules/mysql2/promise");

async function testQuery() {
  const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "localfarm"
  });

  const currentUserId = 4;

  let query = `
    SELECT p.id, p.user_id, p.content, p.privacy, u.username
    FROM posts p
    JOIN users u ON p.user_id = u.id
  `;

  let whereClauses = [
    `(
      p.privacy = 'Public'
      OR p.user_id = ?
      OR (
        p.privacy = 'Friends'
        AND EXISTS (
          SELECT 1 FROM connections c
          WHERE c.status = 'accepted'
            AND (
              (c.sender_id = ? AND c.receiver_id = p.user_id)
              OR
              (c.sender_id = p.user_id AND c.receiver_id = ?)
            )
        )
      )
    )`
  ];

  const params = [
    currentUserId, // for p.user_id = ?
    currentUserId, // for friend connection sender
    currentUserId  // for friend connection receiver
  ];

  query += " WHERE " + whereClauses.join(" AND ");

  console.log("SQL:", query);
  console.log("PARAMS:", params);

  const [rows] = await pool.query(query, params);
  console.log("ROWS RETURNED:", rows);

  process.exit(0);
}

testQuery().catch(console.error);
