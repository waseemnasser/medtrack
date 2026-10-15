const express = require("express");
const cors = require("cors");
const pool = require("./db");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", require("./routes/auth"));
app.use("/api/members", require("./routes/members"));
app.use("/api/medications", require("./routes/medications"));
app.use("/api/catalog", require("./routes/catalog"));

app.use("/api/doses", require("./routes/doses"));

app.use("/api/appointments", require("./routes/appointments"));

app.get("/api/health", async (req, res) => {
    const result = await pool.query("SELECT NOW()");
    res.json({ ok: true, time: result.rows[0].now });
});

app.listen(5000, () => console.log("Server running on port 5000"));