const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

const API_KEY = process.env.GEMINI_API_KEY;
// "gemini-flash-latest" always points to Google's newest Flash model.
// To pin a specific one, set GEMINI_MODEL (for example gemini-2.5-flash).
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

// Simple per-IP rate limit (30 requests per 10 minutes) to protect your API credits
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 30;
}

app.post("/api/ask", async (req, res) => {
  const { prompt, json } = req.body || {};
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 8000) {
    return res.status(400).json({ error: "Invalid prompt" });
  }
  if (!API_KEY) return res.status(500).json({ error: "Server is missing GEMINI_API_KEY" });
  if (limited(req.ip)) return res.status(429).json({ error: "Too many requests" });

  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent",
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": API_KEY },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: json
            ? { responseMimeType: "application/json", maxOutputTokens: 2000 }
            : { maxOutputTokens: 1000 },
        }),
      }
    );
    const data = await r.json();
    if (!r.ok) {
      console.error("Gemini error:", JSON.stringify(data));
      return res.status(r.status === 429 ? 429 : 502).json({ error: "AI service error" });
    }
    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
    const text = parts.map((p) => p.text || "").join("");
    if (!text) return res.status(502).json({ error: "Empty AI response" });
    if (json) {
      const a = text.indexOf("{"), b = text.lastIndexOf("}");
      try {
        return res.json({ data: JSON.parse(text.slice(a, b + 1)) });
      } catch {
        return res.status(502).json({ error: "Bad AI output" });
      }
    }
    res.json({ text });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("AI Tutor running on port " + port));
