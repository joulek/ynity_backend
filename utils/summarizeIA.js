// utils/summarizeIA.js
async function summarizeTextWithIA(text, mode = "long") {
  const prompt =
    mode === "short"
      ? `Résume ce texte de manière brève et concise (moins de 8 lignes) :\n\n${text}`
      : `Voici un contenu de cours à résumer :\n\n${text}\n\nFournis un résumé clair, structuré et détaillé.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama3-8b-8192",
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content: "Tu es un assistant IA expert en résumés pédagogiques.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API Groq Error ${res.status}: ${errorText}`);
  }

  const result = await res.json();
  return result.choices?.[0]?.message?.content || "";
}

module.exports = summarizeTextWithIA;
