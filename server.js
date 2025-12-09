const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(bodyParser.json());
app.use(cors());

// Статика
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));

// ===== FILE-BASED DB =====
const DB_FILE = path.join(__dirname, "users.json");

function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], tokens: {} }, null, 2));
  }
  const raw = fs.readFileSync(DB_FILE, "utf8");
  return JSON.parse(raw);
}

function saveDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function generateId(prefix) {
  return prefix + "_" + crypto.randomBytes(8).toString("hex");
}

function generateToken() {
  return crypto.randomBytes(24).toString("hex");
}

// ===== AUTH MIDDLEWARE =====
function authMiddleware(req, res, next) {
  const auth = req.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Нет токена" });
  }
  const token = auth.slice(7);
  const db = loadDb();
  const userId = db.tokens[token];
  if (!userId) {
    return res.status(401).json({ error: "Неверный или просроченный токен" });
  }
  const user = db.users.find(u => u.id === userId);
  if (!user) {
    return res.status(401).json({ error: "Пользователь не найден" });
  }
  req.user = user;
  req.db = db;
  req.token = token;
  next();
}

// ===== AUTH ROUTES (Telegram / VK / Guest) =====

// Telegram Mini App
app.post("/api/auth/telegram", (req, res) => {
  const { telegramId, firstName, username } = req.body || {};
  if (!telegramId) {
    return res.status(400).json({ error: "Нет telegramId" });
  }

  const db = loadDb();
  let user = db.users.find(u => u.telegramId === String(telegramId));

  if (!user) {
    user = {
      id: generateId("usr"),
      email: null,
      telegramId: String(telegramId),
      telegramUsername: username || null,
      telegramName: firstName || null,
      vkId: null,
      vkUsername: null,
      vkName: null,
      guestId: null,
      karma: 0,
      awareness: 0,
      quizCorrect: 0
    };
    db.users.push(user);
  }

  const token = generateToken();
  db.tokens[token] = user.id;
  saveDb(db);

  res.json({
    token,
    user: {
      id: user.id,
      karma: user.karma,
      awareness: user.awareness,
      quizCorrect: user.quizCorrect,
      telegramId: user.telegramId,
      telegramUsername: user.telegramUsername,
      telegramName: user.telegramName
    }
  });
});

// VK Mini App
app.post("/api/auth/vk", (req, res) => {
  const { vkId, firstName, lastName, username } = req.body || {};
  if (!vkId) {
    return res.status(400).json({ error: "Нет vkId" });
  }

  const db = loadDb();
  let user = db.users.find(u => u.vkId === String(vkId));

  if (!user) {
    user = {
      id: generateId("usr"),
      email: null,
      telegramId: null,
      telegramUsername: null,
      telegramName: null,
      vkId: String(vkId),
      vkUsername: username || null,
      vkName: [firstName, lastName].filter(Boolean).join(" "),
      guestId: null,
      karma: 0,
      awareness: 0,
      quizCorrect: 0
    };
    db.users.push(user);
  }

  const token = generateToken();
  db.tokens[token] = user.id;
  saveDb(db);

  res.json({
    token,
    user: {
      id: user.id,
      karma: user.karma,
      awareness: user.awareness,
      quizCorrect: user.quizCorrect,
      vkId: user.vkId,
      vkUsername: user.vkUsername,
      vkName: user.vkName
    }
  });
});

// Guest (браузер dev / standalone)
app.post("/api/auth/guest", (req, res) => {
  const { guestId, nickname } = req.body || {};
  if (!guestId) {
    return res.status(400).json({ error: "Нет guestId" });
  }
  const db = loadDb();
  let user = db.users.find(u => u.guestId === String(guestId));

  if (!user) {
    user = {
      id: generateId("usr"),
      email: null,
      telegramId: null,
      telegramUsername: null,
      telegramName: null,
      vkId: null,
      vkUsername: null,
      vkName: null,
      guestId: String(guestId),
      guestName: nickname || "guest",
      karma: 0,
      awareness: 0,
      quizCorrect: 0
    };
    db.users.push(user);
  } else if (nickname && !user.guestName) {
    user.guestName = nickname;
  }

  const token = generateToken();
  db.tokens[token] = user.id;
  saveDb(db);

  res.json({
    token,
    user: {
      id: user.id,
      karma: user.karma,
      awareness: user.awareness,
      quizCorrect: user.quizCorrect,
      guestId: user.guestId,
      guestName: user.guestName
    }
  });
});

// Current user
app.get("/api/user/me", authMiddleware, (req, res) => {
  const u = req.user;
  res.json({
    id: u.id,
    karma: u.karma,
    awareness: u.awareness,
    quizCorrect: u.quizCorrect,
    telegramId: u.telegramId,
    telegramName: u.telegramName,
    telegramUsername: u.telegramUsername,
    vkId: u.vkId,
    vkName: u.vkName,
    vkUsername: u.vkUsername,
    guestId: u.guestId,
    guestName: u.guestName
  });
});

// ===== ACTIONS =====
const WHEEL_OUTCOMES = [
  { type: "karma", amount: 5, label: "+5 кармы" },
  { type: "karma", amount: 10, label: "+10 кармы" },
  { type: "karma", amount: 25, label: "+25 кармы (серия внимания)" },
  { type: "pause", amount: 0, label: "Пауза: 3 осознанных вдоха" },
  { type: "awareness", amount: 1, label: "+1 токен осознанности" },
  { type: "awareness", amount: 2, label: "+2 токена осознанности" },
  { type: "nothing", amount: 0, label: "Ничего. Просто заметь реакцию." },
  { type: "karma", amount: 3, label: "+3 кармы" }
];

app.post("/api/actions/karma-click", authMiddleware, (req, res) => {
  const db = req.db;
  const user = db.users.find(u => u.id === req.user.id);
  user.karma += 1;
  saveDb(db);
  res.json({ karma: user.karma });
});

app.post("/api/actions/wheel-spin", authMiddleware, (req, res) => {
  const db = req.db;
  const user = db.users.find(u => u.id === req.user.id);

  const outcome = WHEEL_OUTCOMES[Math.floor(Math.random() * WHEEL_OUTCOMES.length)];
  let message = "";
  if (outcome.type === "karma") {
    user.karma += outcome.amount;
    message = `Результат: ${outcome.label}`;
  } else if (outcome.type === "awareness") {
    user.awareness += outcome.amount;
    message = `Результат: ${outcome.label}`;
  } else if (outcome.type === "pause") {
    message = "Пауза. Сделай 3 мягких вдоха и выдоха, отметь ощущения.";
  } else {
    message = "На этот раз — пусто. Заметь, как это ощущается.";
  }

  saveDb(db);
  res.json({
    outcome,
    message,
    user: {
      karma: user.karma,
      awareness: user.awareness,
      quizCorrect: user.quizCorrect
    }
  });
});

app.post("/api/actions/quiz-correct", authMiddleware, (req, res) => {
  const db = req.db;
  const user = db.users.find(u => u.id === req.user.id);
  const { awarenessReward = 1 } = req.body || {};

  user.quizCorrect += 1;
  user.awareness += Number(awarenessReward) || 1;

  saveDb(db);
  res.json({
    karma: user.karma,
    awareness: user.awareness,
    quizCorrect: user.quizCorrect
  });
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`HeartWins miniapp backend running on port ${PORT}`);
});
