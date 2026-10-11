# AI Tutor for Rural Students (SDG 4: Quality Education)

An AI tutor that teaches any school subject (Class 6-10) in the student's own language, adapts to their progress, and quizzes them on weak topics.

**Live demo:** (paste your deployed link here)

## How it works
- `public/index.html` - frontend (chat, quiz, progress tracking)
- `api/ask.js` - backend for Vercel (serverless). `server.js` - same backend for Render/local (Node + Express). Keeps the Gemini API key secret and calls the Gemini model.
- Agent loop: Perceive -> Plan -> Act -> Learn, with memory of the student's score and weak topics.

## Run locally
1. Install Node.js 18+
2. `npm install`
3. Create a `.env` file with `GEMINI_API_KEY=your-key` (see `.env.example`)
4. `GEMINI_API_KEY=your-key npm start` (or load `.env` with your tool of choice)
5. Open http://localhost:3000

## Deploy on Vercel (recommended, no sleeping)
Import this GitHub repo at vercel.com -> leave build settings as default -> add env var `GEMINI_API_KEY` -> Deploy. The backend is `api/ask.js`.

## Deploy on Render (alternative)
New Web Service -> connect this repo -> Build: `npm install` -> Start: `npm start` -> add env var `GEMINI_API_KEY`.

Other project files: Lean Canvas, Concept Note, and presentation are in the submission.
