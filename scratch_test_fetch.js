const jwt = require("./server/node_modules/jsonwebtoken");
const http = require("http");

const JWT_SECRET = "localfarm_jwt_super_secret_key_2026";

async function testFetch() {
  const tokenForUser4 = jwt.sign({ id: 4, username: "nathansalvedia", role: "field" }, JWT_SECRET, { expiresIn: "7d" });

  const fetchWithToken = (token) => {
    return new Promise((resolve, reject) => {
      const headers = token ? { "Authorization": `Bearer ${token}` } : {};
      http.get("http://localhost:5000/api/posts", { headers }, (res) => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => resolve(JSON.parse(data)));
      }).on("error", reject);
    });
  };

  const user4Result = await fetchWithToken(tokenForUser4);
  console.log("USER 4 RESULT (With token):", user4Result.posts.map(p => ({ id: p.id, authorName: p.authorName, category: p.category })));

  process.exit(0);
}

testFetch().catch(console.error);
