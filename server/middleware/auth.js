const jwt = require("jsonwebtoken");

function auth(req, res, next) {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: "غير مصرح" });

    const token = header.split(" ")[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.id;
        next();
    } catch {
        return res.status(401).json({ error: "الجلسة منتهية، سجل دخول من جديد" });
    }
}

module.exports = auth;