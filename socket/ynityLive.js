const { Server } = require("socket.io");
let rooms = {};

function getSafeRoom(room) {
  return {
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      ready: p.ready,
    })),
  };
}

function ynityLive(server) {
  const io = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("🟢 Socket connecté :", socket.id);

    socket.on("createRoom", ({ playerName }, callback) => {
      const roomId = Math.random().toString(36).substring(2, 8);
      rooms[roomId] = {
        players: [{ id: socket.id, name: playerName, score: 0, ready: false }],
        courseId: null,
      };
      socket.join(roomId);
      callback(roomId);
      io.to(roomId).emit("roomUpdate", getSafeRoom(rooms[roomId]));
    });

    socket.on("joinRoom", ({ roomId, playerName }) => {
      const room = rooms[roomId];
      if (!room) return;

      room.players.push({
        id: socket.id,
        name: playerName,
        score: 0,
        ready: false,
      });
      socket.join(roomId);
      io.to(roomId).emit("roomUpdate", getSafeRoom(room));
    });
socket.on("playerReady", async ({ roomId, courseId }) => {
  const room = rooms[roomId];
  if (!room) return;

  const player = room.players.find((p) => p.id === socket.id);
  if (player) player.ready = true;

  if (!room.courseId && courseId) {
    room.courseId = courseId;
  }

  io.to(roomId).emit("roomUpdate", getSafeRoom(room));

  if (room.players.length >= 2 && room.players.every((p) => p.ready)) {
    console.log("🎬 Tous les joueurs sont prêts. Chargement des questions...");

    let questions = [];
    let coachMessage = "You're doing great!";
    const courseIdUsed = room.courseId;

    try {
      const res = await fetch("https://quiz-agent-production.up.railway.app/quiz/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: courseIdUsed }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Erreur serveur : ${errorText}`);
      }

      const data = await res.json();
      questions = data.questions || [];
      coachMessage = data.coach || coachMessage;

      if (!questions.length) {
        console.log("❌ Aucun flashcard trouvé via quiz_agent pour le cours :", courseIdUsed);
        return;
      }
    } catch (err) {
      console.error("❌ Erreur fetch quiz_agent/init :", err.message);
      return;
    }

    io.to(roomId).emit("startQuiz");

    let qIndex = 0;
    let currentQuestion = null;
    let timer = null;
    const answeredPlayers = new Set();

    const sendQuestion = async () => {
      if (qIndex >= questions.length) {
        const ranking = [...room.players].sort((a, b) => b.score - a.score);
        io.to(roomId).emit("quizEnd", ranking);
        return;
      }

      try {
        const res = await fetch("https://quiz-agent-production.up.railway.app/quiz/next", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questions, index: qIndex }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error("Erreur fetch quiz/next: " + errText);
        }

        const data = await res.json();

        if (data.end) {
          const ranking = [...room.players].sort((a, b) => b.score - a.score);
          io.to(roomId).emit("quizEnd", ranking);
          return;
        }

        currentQuestion = data.question;
        answeredPlayers.clear();
        io.to(roomId).emit("question", { data: currentQuestion, time: 15 });

        if (data.coach) {
          io.to(roomId).emit("coachMessage", { text: data.coach });
        }

        timer = setTimeout(() => {
          qIndex++;
          sendQuestion();
        }, 15000);
      } catch (err) {
        console.error("❌ Erreur fetch quiz/next :", err.message);
        io.to(roomId).emit("coachMessage", { text: "⚠️ Erreur de chargement des questions." });
      }
    };

    // 🚀 Start quiz
    sendQuestion();
  }
});



    // ✅ Gestion des réponses de tous les sockets
    socket.on("answer", ({ correct }) => {
      const roomId = Object.keys(rooms).find((id) =>
        rooms[id].players.some((p) => p.id === socket.id)
      );
      if (!roomId) return;

      const room = rooms[roomId];
      const player = room.players.find((p) => p.id === socket.id);

      if (player && correct) {
        player.score += 10;
        io.to(roomId).emit("roomUpdate", getSafeRoom(room)); // ⬅️ met à jour les scores visibles
      }
    });

    socket.on("disconnect", () => {
      for (const [roomId, room] of Object.entries(rooms)) {
        room.players = room.players.filter((p) => p.id !== socket.id);
        io.to(roomId).emit("roomUpdate", getSafeRoom(room));
        if (room.players.length === 0) {
          delete rooms[roomId];
        }
      }
      console.log("🔴 Déconnexion socket:", socket.id);
    });
  });
}

module.exports = ynityLive;
