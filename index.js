const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const path = require("path");
const http = require("http");
const cors = require("cors");
require("dotenv").config();
require("./config/passport"); // Auth Google
require("./reminderScheduler"); // Cron tâches

const app = express();
const server = http.createServer(app);
const setupLiveSocket = require("./socket/ynityLive");
setupLiveSocket(server);

// ✅ Middleware JSON
app.use(express.json());

// ✅ CORS avant tout
const allowedOrigins = [
  "http://localhost:5173",
  "https://front-ynity-x6sa.vercel.app",
  "https://ynity-backend.onrender.com" // Ajoutez ceci


];

app.use(cors({
  origin: function (origin, callback) {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      origin.endsWith(".vercel.app") // ✅ permet les URLs dynamiques de Vercel
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS: " + origin));
    }
  },
  credentials: true
}));

// ✅ Session + Cookie sécurisé pour cross-domain
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: true,
    sameSite: "none"
  }
}));

// ✅ Auth Google
app.use(passport.initialize());
app.use(passport.session());

// ✅ Routes
const authRoutes = require('./routes/auth');
app.use(authRoutes);
const courseRoutes = require('./routes/course');
app.use('/api/course', courseRoutes);
const flashcardRoutes = require("./routes/flashcard");
app.use("/api/flashcards", flashcardRoutes);
const attemptRoutes = require("./routes/Attempt");
app.use("/api/attempts", attemptRoutes);
const planningRoutes = require("./routes/Planning");
app.use("/api/planning", planningRoutes);
const SubjectsRoutes = require("./routes/Subject");
app.use("/api/subject", SubjectsRoutes);
const examRoutes = require("./routes/Exam");
app.use("/api/exam", examRoutes);
const chatbotRoutes = require("./routes/chatbot");
app.use("/api/chatbot", chatbotRoutes);
const usageRoutes = require("./routes/tracking");
app.use("/api/usage", usageRoutes);
const RevisionRoutes = require("./routes/revision");
app.use("/api/revision", RevisionRoutes);
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/notifications", require("./routes/notificationUI"));

// ✅ Fichiers statiques
app.use("/files", express.static(path.join(__dirname, "public/files")));
app.use("/audio", express.static(path.join(__dirname, "public/audio")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ Auth Google
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect(process.env.FRONTEND_URL + "/home");
  }
);

app.get('/auth/logout', (req, res) => {
  req.logout(() => {
    res.redirect(process.env.FRONTEND_URL + "/login");
  });
});

// ✅ Test route
app.get("/", (req, res) => {
  res.send("🚀 YnityLearn backend is running & Google Auth ready");
});

// ✅ MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// ✅ Lancer serveur
const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log("✅ Server + WebSocket lancé sur port " + PORT);
});
