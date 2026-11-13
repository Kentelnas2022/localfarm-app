const mysql = require("./server/node_modules/mysql2/promise");

async function check() {
  const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "localfarm"
  });

  const [cols] = await pool.query("DESCRIBE posts");
  console.log("COLUMNS:", cols.map(c => c.Field));

  const [posts] = await pool.query("SELECT * FROM posts");
  console.log("ALL POSTS:", posts);

  process.exit(0);
}

check().catch(console.error);
