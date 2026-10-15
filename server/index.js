const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
    user: "postgres",
    password: process.env.DB_PASSWORD,
    host: "localhost",
    port: 5432,
    database: "medtrack",
});

app.get("/api/health", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");
        res.json({ ok: true, time: result.rows[0].now });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.listen(5000, () => console.log("Server running on port 5000"));

module.exports = { pool };