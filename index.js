const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const path = require("path");
const http = require("http");
const cors = require("cors");
require("dotenv").config();
require("./config/passport"); // ✅ Ton fichier passport.js dans /config
require("./reminderScheduler"); // ou l’endroit où tu mets la tâche cron
const app = express();
const server = http.createServer(app);
const setupLiveSocket = require("./socket/ynityLive");
setupLiveSocket(server);


// 🔐 Middlewares
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
   cookie: { secure: true } // mettre true si https (Render oui)
}));



app.use(passport.initialize());
app.use(passport.session());
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));
const authRoutes = require('./routes/auth');
app.use(authRoutes); // doit être après session et passport
const courseRoutes = require('./routes/course');
app.use('/api/course', courseRoutes);
const flashcardRoutes = require("./routes/flashcard");
app.use("/api/flashcards", flashcardRoutes);
const attemptRoutes = require("./routes/Attempt");   // nom du fichier en minuscules
app.use("/api/attempts", attemptRoutes);             // même casse partout
const planningRoutes = require("./routes/Planning");   // nom du fichier en minuscules
app.use("/api/planning", planningRoutes); // ✅ ici
// 🔗 MongoDB
const SubjectsRoutes = require("./routes/Subject");   // nom du fichier en minuscules
app.use("/api/subject", SubjectsRoutes); // ✅ ici
const examRoutes = require("./routes/Exam");   // nom du fichier en minuscules
app.use("/api/exam", examRoutes); // ✅ ici


app.use("/files", express.static(path.join(__dirname, "public/files")));


app.use("/audio", express.static(path.join(__dirname, "public/audio")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/notifications", require("./routes/notifications"));


const notificationUIRoutes = require("./routes/notificationUI");
app.use("/api/notifications", notificationUIRoutes);


const chatbotRoutes = require("./routes/chatbot");
app.use("/api/chatbot", chatbotRoutes);

const usageRoutes = require("./routes/tracking");
app.use("/api/usage", usageRoutes);





const RevisionRoutes = require("./routes/revision");   // nom du fichier en minuscules
app.use("/api/revision", RevisionRoutes); // ✅ ici
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connected"))
.catch((err) => console.error("❌ MongoDB error:", err));

// 🔐 Google OAuth Routes
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    // ✅ Rediriger vers frontend après connexion
   res.redirect(process.env.FRONTEND_URL + "/home");
  }
);


app.get('/auth/logout', (req, res) => {
  req.logout(() => {
    res.redirect('http://localhost:5173/login');

  });
});


// 🧪 Test Route
app.get("/", (req, res) => {
  res.send("🚀 YnityLearn backend is running & Google Auth ready");
});

const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log("✅ Server + WebSocket lancé sur port " + PORT);
});