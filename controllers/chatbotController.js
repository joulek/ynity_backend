
const path = require("path");

const axios = require("axios");
const getChatbotResponse = require("../utils/uAgentChatbot");
const Conversation = require("../models/Conversation");
const { textToSpeech } = require("../utils/ttsElevenLabs");
const fs = require("fs");
const { generateTextFile, generatePDF } = require("../utils/fileGenerator");
const { generateImage } = require("../utils/imageGenerator");


exports.askChatbot = async (req, res) => {
  const { question, conversationId, useVoice } = req.body;
  const userId = req.user._id;

  if (!question) return res.status(400).json({ error: "Missing question" });

  try {
    let isNew = false;
    let conversation =
      conversationId &&
      (await Conversation.findOne({ _id: conversationId, userId }));

    if (!conversation || conversation.messages.length > 50) {
      isNew = true;
      conversation = new Conversation({ userId, messages: [] });
    }

    // 🔹 Add user message
    conversation.messages.push({ role: "user", content: question });

    // 🔹 Check if message should trigger the CoachAgent
    const lowerQuestion = question.toLowerCase();

    const triggers = [
      "i'm tired", "i feel down", "i'm discouraged", "i can't anymore",
      "no motivation", "i give up", "i feel lost", "help me",
      "burned out", "i'm exhausted", "i feel stuck", "need encouragement",
      "stressed", "overwhelmed", "depressed", "i'm anxious",
      "i'm sad", "i need support", "i'm hopeless"
    ];

    const isCoachMessage = triggers.some(trigger =>
      lowerQuestion.includes(trigger)
    );

    if (isCoachMessage) {
      // 🔹 Call CoachAgent only for motivational messages
      const coachRes = await axios.post("https://coach-agent-24z5.onrender.com/agent/chat", {
        prompt: question,
      });

      const coachReply =
        coachRes.data?.reply || "I'm here to encourage you and help you move forward!";

      // 🔹 Add coach message to conversation
      conversation.messages.push({
        role: "coach",
        content: coachReply,
      });

      // 🔹 Generate title if it's a new conversation
      if (isNew) {
        conversation.title = `Motivational Support - ${new Date().toLocaleDateString()}`;
      }

      await conversation.save();

      return res.json({
        content: coachReply,
        source: "coach",
        conversationId: conversation._id,
        title: conversation.title,
      });
    }

    // 🔹 Standard chatbot processing
    const historyPrompt =
      conversation.messages
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n") + `\nUser: ${question}`;

    const chatbotRes = await axios.post("https://chatbot-agent-giwf.onrender.com/agent/chat", {
      prompt: historyPrompt,
    });

    const replyText = chatbotRes.data.reply || "I'm not sure I understand your question.";

    // 🔹 Generate title for new conversation
    if (isNew) {
      const titlePrompt = `Generate a short title for this conversation: ${question}`;
      const titleRes = await axios.post("https://chatbot-agent-giwf.onrender.com/agent/chat", {
        prompt: titlePrompt,
      });
      conversation.title = (titleRes.data.reply || "New conversation").slice(0, 50);
    }

    // 🔹 Special response formats
    let audioUrl = null;
    let fileUrl = null;
    let imageUrl = null;

    const wantsVoice =
      useVoice ||
      lowerQuestion.includes("voice reply") ||
      lowerQuestion.includes("respond in voice");

    if (wantsVoice) {
      const audioBuffer = await textToSpeech(replyText);
      const fileName = `resp-${Date.now()}.mp3`;
      const audioPath = path.join(__dirname, "../public/audio", fileName);
      fs.mkdirSync(path.dirname(audioPath), { recursive: true });
      fs.writeFileSync(audioPath, audioBuffer);
      audioUrl = `/audio/${fileName}`;
    }

    if (lowerQuestion.includes("pdf file") || lowerQuestion.includes("pdf")) {
      fileUrl = generatePDF(replyText);
    }

    if (lowerQuestion.includes("image")) {
      const generatedImage = await generateImage(question);
      if (generatedImage) {
        imageUrl = generatedImage;
      }
    }

    // 🔹 Add assistant reply to conversation
    conversation.messages.push({
      role: "bot",
      content: replyText,
      ...(audioUrl && { audioUrl }),
      ...(imageUrl && { imageUrl }),
      ...(fileUrl && { fileLink: fileUrl }),
    });

    await conversation.save();

    res.json({
      content: replyText,
      source: "bot",
      ...(audioUrl && { audioUrl }),
      ...(fileUrl && { fileUrl }),
      ...(imageUrl && { imageUrl }),
      conversationId: conversation._id,
      title: conversation.title,
    });

  } catch (err) {
    console.error("❌ Chatbot error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getConversationHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const conversation = await Conversation.findOne({ userId }).sort({
      createdAt: -1,
    });

    if (!conversation) return res.json({ messages: [] });
    res.json({ messages: conversation.messages });
  } catch (err) {
    console.error("❌ Erreur historique:", err);
    res
      .status(500)
      .json({ error: "Erreur lors du chargement de l'historique" });
  }
};

exports.getAllConversations = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ error: "Non authentifié" });

    const conversations = await Conversation.find({ userId }).sort({
      createdAt: -1,
    });
    res.json(conversations);
  } catch (err) {
    console.error("Erreur getAllConversations:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

exports.getConversationById = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!conversation)
      return res.status(404).json({ error: "Conversation introuvable" });
    res.json(conversation);
  } catch (err) {
    res.status(500).json({ error: "Erreur récupération conversation" });
  }
};

exports.createConversation = async (req, res) => {
  const { title } = req.body;
  const conversation = new Conversation({
    userId: req.user._id,
    title: title || "New conversation",
    messages: [],
  });
  await conversation.save();
  res.json(conversation);
};

// ✅ Renommer une conversation
exports.renameConversation = async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;
  const userId = req.user._id;

  try {
    const conversation = await Conversation.findOneAndUpdate(
      { _id: id, userId },
      { title },
      { new: true }
    );
    if (!conversation)
      return res.status(404).json({ error: "Conversation not found" });
    res.json(conversation);
  } catch (err) {
    console.error("Erreur renommage :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// ✅ Supprimer une conversation
exports.deleteConversation = async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  try {
    const result = await Conversation.deleteOne({ _id: id, userId });
    res.json({ success: result.deletedCount === 1 });
  } catch (err) {
    console.error("Erreur suppression :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

exports.transcribeAudio = async (req, res) => {
  const filePath = req.file.path;

  try {
    const formData = new FormData();
    formData.append("file", fs.createReadStream(filePath));
    formData.append("model", "whisper-1");

    const whisperRes = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      formData,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          ...formData.getHeaders(),
        },
      }
    );

    res.json({ text: whisperRes.data.text });
  } catch (err) {
    console.error("Transcription error:", err);
    res.status(500).json({ error: "Erreur de transcription" });
  } finally {
    fs.unlinkSync(filePath);
  }
};

exports.chatbotReplyWithTTS = async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message vide" });

  try {
    const reply = await getChatbotResponse([
      { role: "user", content: message },
    ]);
    const audioBuffer = await textToSpeech(reply);

    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audioBuffer);
  } catch (err) {
    console.error("Erreur de réponse vocale :", err);
    res
      .status(500)
      .json({ error: "Erreur dans la génération de la réponse vocale" });
  }
};
