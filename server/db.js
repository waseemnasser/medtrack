const { Pool, types } = require("pg");
require("dotenv").config();

// خلي حقول DATE ترجع نص كما هي بدون تحويل توقيت
types.setTypeParser(1082, (value) => value);
types.setTypeParser(1114, (value) => value);   // TIMESTAMP WITHOUT TIME ZONE

const pool = new Pool({
    user: "postgres",
    password: process.env.DB_PASSWORD,
    host: "localhost",
    port: 5432,
    database: "medtrack",
});

module.exports = pool;