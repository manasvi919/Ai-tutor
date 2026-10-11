// Vercel serverless function: POST /api/ask

const API_KEY = process.env.GEMINI_API_KEY;
// Tries your chosen model first, then backups, if one is busy or unavailable.
const MODELS = [...new Set([process.env.GEMINI_MODEL, "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"].filter(Boolean))].slice(0, 3);

async function callGemini(prompt, json) {
  let last = { status: 502, detail: "No model answered" };
  for (const model of MODELS) {
    try {
      const r = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent",
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": API_KEY },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: json
              ? { responseMimeType: "application/json", maxOutputTokens: 2000 }
              : { maxOutputTokens: 1000 },
          }),
          signal: AbortSignal.timeout(8000),
        }
      );
      const data = await r.json();
      if (r.ok) {
        const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
        const text = parts.map((p) => p.text || "").join("");
        if (text) return { ok: true, text };
        last = { status: 502, detail: "Empty AI response" };
        continue;
      }
      const detail = (data.error && data.error.message) || "";
      console.error("Gemini error (" + model + "):", JSON.stringify(data));
      last = { status: r.status === 429 ? 429 : 502, detail };
      if ([404, 429, 500, 503, 504].includes(r.status)) continue; // try next model
      break; // key or request problem: other models won't help
    } catch (e) {
      console.error("Gemini call failed (" + model + "):", e.message);
      last = { status: 502, detail: "Model timed out" };
    }
  }
  return { ok: false, ...last };
}

function parseJson(text) {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  return JSON.parse(text.slice(a, b + 1));
}

// Simple per-IP rate limit (30 requests per 10 minutes) to protect your free quota
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 30;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  const { prompt, json } = req.body || {};
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 8000) {
    return res.status(400).json({ error: "Invalid prompt" });
  }
  if (!API_KEY) return res.status(500).json({ error: "Server is missing GEMINI_API_KEY" });
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0] || "unknown";
  if (limited(ip)) return res.status(429).json({ error: "Too many requests" });

  const out = await callGemini(prompt, json);
  if (!out.ok) return res.status(out.status).json({ error: "AI service error", detail: out.detail });
  if (json) {
    try { return res.json({ data: parseJson(out.text) }); }
    catch { return res.status(502).json({ error: "Bad AI output" }); }
  }
  return res.json({ text: out.text });
};
