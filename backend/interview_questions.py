"""
Generates interview questions using Groq, tailored to the candidate's resume
and the target job description. Returns clean JSON so the frontend can render
it directly without further parsing headaches.
"""
import os
import json
from groq import Groq

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
MODEL_NAME = "llama-3.3-70b-versatile"

PROMPT_TEMPLATE = """You are an experienced technical interviewer.

Given the candidate's RESUME and the JOB DESCRIPTION below, generate interview
questions tailored to this specific candidate and role.

Return ONLY valid JSON (no markdown, no commentary) in exactly this shape:
{{
  "technical_questions": ["...", "..."],
  "resume_specific_questions": ["...", "..."],
  "behavioral_questions": ["...", "..."],
  "missing_skill_questions": ["...", "..."]
}}

Rules:
- technical_questions: 5 questions testing core skills required by the JD.
- resume_specific_questions: 5 questions that reference specific projects,
  internships, or experience mentioned in the resume.
- behavioral_questions: 3 standard behavioral/HR questions relevant to the role.
- missing_skill_questions: 2 questions probing skills the JD wants but the
  resume doesn't clearly show, to test if the candidate can still speak to them.

RESUME:
{resume_text}

JOB DESCRIPTION:
{jd_text}
"""


def generate_interview_questions(resume_text: str, jd_text: str) -> dict:
    if not GROQ_API_KEY:
        raise RuntimeError(
            "GROQ_API_KEY is not set. Add it to your .env file before calling this endpoint."
        )

    client = Groq(api_key=GROQ_API_KEY)
    prompt = PROMPT_TEMPLATE.format(
        resume_text=resume_text[:6000],  # guard against overly long inputs
        jd_text=jd_text[:3000],
    )

    response = client.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": prompt,
            }
        ],
        model=MODEL_NAME,
        temperature=0.3,
        response_format={"type": "json_object"}
    )
    raw = response.choices[0].message.content.strip()

    # Gemini sometimes wraps JSON in ```json ... ``` despite instructions — strip it defensively.
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: return raw text so the frontend can still show *something*
        # instead of a hard failure.
        return {
            "technical_questions": [],
            "resume_specific_questions": [],
            "behavioral_questions": [],
            "missing_skill_questions": [],
            "raw_response": raw,
            "parse_error": True,
        }
