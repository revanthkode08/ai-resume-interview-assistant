# AI Resume & Interview Assistant

A full-stack AI-powered tool that analyzes a resume against a job description,
computes an ATS (Applicant Tracking System) score, highlights skill gaps, and
generates tailored interview questions using Gemini.

## Architecture

```
frontend (React + Vite)  --->  backend (FastAPI)  --->  Gemini API
                                      |
                                      v
                                  MongoDB (history, optional)
```

- **Resume parsing**: pdfplumber / python-docx extract raw text from uploaded files.
- **Skill extraction**: regex matching against a curated skill dictionary
  (explainable, no black-box NER — good for defending in viva).
- **ATS score**: weighted blend of (1) semantic similarity via
  Sentence-Transformers embeddings + cosine similarity, and (2) keyword
  overlap percentage. Blending both avoids the weaknesses of either alone.
- **Interview questions**: Gemini generates technical, resume-specific,
  behavioral, and "missing skill" probing questions in structured JSON.

## Setup

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and paste your GEMINI_API_KEY
uvicorn main:app --reload --port 8000
```

The first run will download the `all-MiniLM-L6-v2` sentence-transformer model
(~80MB) — needs internet access once, then it's cached locally.

MongoDB is optional. If you don't have it running, the app still works —
analysis history just won't be saved. To run Mongo locally with Docker:

```bash
docker run -d -p 27017:27017 --name mongo mongo
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`). The Vite dev
server proxies `/api` calls to the backend on port 8000.

## Getting a Gemini API Key

1. Go to https://aistudio.google.com/apikey
2. Create a key (free tier is generous for development/demo use)
3. Paste it into `backend/.env` as `GEMINI_API_KEY=...`

## Project Structure

```
backend/
  main.py                 # FastAPI app and routes
  resume_parser.py         # PDF/DOCX/TXT text extraction
  skill_bank.py             # Curated skill keyword dictionary
  skill_extractor.py         # Skill matching + gap analysis
  ats_scorer.py               # Semantic + keyword ATS scoring
  interview_questions.py       # Gemini prompt + call
  requirements.txt
  .env.example
frontend/
  src/App.jsx               # Main UI (upload, JD input, results)
  src/index.css
  package.json
  vite.config.js
```

## Possible Extensions (good to mention in your report as "Future Scope")

- Job recommendation engine using a job-listings API + embedding similarity
- Voice-based mock interview using speech-to-text + Gemini + text-to-speech
- LeetCode/coding-practice progress tracker integration
- RAG-based answer feedback during mock interviews (LangChain + ChromaDB)
- Multi-resume comparison / batch screening for recruiters

## Viva / Interview Talking Points

- **Why not just use an LLM for everything (including skill matching)?**
  Keyword-based skill extraction is deterministic and explainable — you can
  show exactly *why* a skill was marked missing. LLMs alone can hallucinate
  or be inconsistent across runs, which is risky for a score students/
  recruiters will rely on.
- **Why blend semantic similarity and keyword matching for ATS score?**
  Keyword-only scoring misses paraphrased skills ("built REST APIs" vs
  "API development"). Semantic-only scoring can be gamed by buzzword
  stuffing without real keyword relevance. Blending both is more robust —
  this mirrors how real-world ATS systems combine rule-based and ML scoring.
- **Why FastAPI over Flask?** Async support, automatic OpenAPI docs at
  `/docs`, and built-in request validation via Pydantic — useful for a
  production-style API.
