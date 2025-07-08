const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const path = require("path");
const http = require("http");
const cors = require("cors");
require("dotenv").config();
require("./config/passport");
require("./reminderScheduler");
const setupLiveSocket = require("./socket/ynityLive");

const app = express();
const server = http.createServer(app);
setupLiveSocket(server);

// CORS d'abord
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

// Middleware JSON
app.use(express.json());

// Sessions sécurisées
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    httpOnly: true,
    sameSite: "none"
  }
}));

// Auth
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use(require("./routes/auth"));
app.use("/api/course", require("./routes/course"));
app.use("/api/flashcards", require("./routes/flashcard"));
app.use("/api/attempts", require("./routes/Attempt"));
app.use("/api/planning", require("./routes/Planning"));
app.use("/api/subject", require("./routes/Subject"));
app.use("/api/exam", require("./routes/Exam"));
app.use("/api/revision", require("./routes/revision"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/notifications", require("./routes/notificationUI"));
app.use("/api/chatbot", require("./routes/chatbot"));
app.use("/api/usage", require("./routes/tracking"));

// Fichiers statiques
app.use("/files", express.static(path.join(__dirname, "public/files")));
app.use("/audio", express.static(path.join(__dirname, "public/audio")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Auth Google
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect(process.env.FRONTEND_URL + "/home");
  }
);

app.get("/auth/logout", (req, res) => {
  req.logout(() => {
    res.redirect(process.env.FRONTEND_URL + "/login");
  });
});

// Test
app.get("/", (req, res) => {
  res.send("🚀 YnityLearn backend is running & Google Auth ready");
});

// MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log("✅ MongoDB connected");
}).catch(err => {
  console.error("❌ MongoDB error:", err);
});

const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log("✅ Server + WebSocket lancé sur port " + PORT);
});
