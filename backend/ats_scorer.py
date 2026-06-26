"""
ATS Score = blend of:
  1. Semantic similarity between resume text and JD text (Sentence-Transformers + cosine similarity)
  2. Skill keyword overlap percentage (explainable, matches what real ATS systems do)

Final score is a weighted average. This dual approach is a good viva talking point:
"semantic similarity alone can be gamed by buzzword stuffing, and keyword
matching alone misses synonyms/paraphrased experience, so we combine both."
"""
from functools import lru_cache
import os
import json
from groq import Groq
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer

from skill_extractor import extract_skills, compute_skill_gap

SEMANTIC_WEIGHT = 0.80
QUALIFICATION_WEIGHT = 0.10
REWARDS_WEIGHT = 0.05
PARTICIPATION_WEIGHT = 0.05

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
MODEL_NAME = "llama-3.3-70b-versatile"

SEMANTIC_PROMPT_TEMPLATE = """You are an advanced ATS (Applicant Tracking System) parser.
Evaluate the semantic similarity between the candidate's RESUME and the JOB DESCRIPTION.

Semantic similarity means checking if the candidate has the relevant background, skills, and experience for the job, even if they use different words or synonyms (e.g., "frontend engineer" vs "web developer", or "created a web app" vs "built a client-side interface").

Evaluate objectively on a scale of 0.0 to 100.0.
Be fair:
- If the candidate's background matches the job description perfectly (even with synonym variations), score it 85-100%.
- If the candidate's background is somewhat related (e.g., backend developer applying for a fullstack role with some frontend overlap), score it 50-80%.
- If the candidate's background is completely unrelated (e.g., accountant applying for a software engineer role), score it below 30%.

Return ONLY valid JSON (no markdown, no commentary) in exactly this shape:
{{
  "semantic_score": 85.5,
  "explanation": "..."
}}

RESUME:
{resume_text}

JOB DESCRIPTION:
{jd_text}
"""


def lexical_similarity_fallback(resume_text: str, jd_text: str) -> float:
    # Fallback to TF-IDF if API is unavailable
    vectorizer = TfidfVectorizer(stop_words='english')
    try:
        tfidf = vectorizer.fit_transform([resume_text, jd_text])
        sim = float(cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0])
        sim = max(0.0, min(1.0, sim))
        return round(sim * 100, 1)
    except Exception:
        return 0.0


def semantic_similarity(resume_text: str, jd_text: str) -> float:
    # Handle empty text defensive checks
    if not resume_text.strip() or not jd_text.strip():
        return 0.0

    if not GROQ_API_KEY:
        return lexical_similarity_fallback(resume_text, jd_text)

    try:
        client = Groq(api_key=GROQ_API_KEY)
        prompt = SEMANTIC_PROMPT_TEMPLATE.format(
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
            temperature=0.2,
            response_format={"type": "json_object"}
        )
        raw = response.choices[0].message.content.strip()
        data = json.loads(raw)
        score = float(data.get("semantic_score", 0.0))
        return max(0.0, min(100.0, score))
    except Exception as e:
        print(f"[AUTH] Groq semantic similarity failed, falling back: {e}")
        return lexical_similarity_fallback(resume_text, jd_text)


def evaluate_profile_factors(resume_text: str) -> dict:
    text_lower = resume_text.lower()

    # 1. Qualifications (Degrees and Certifications)
    qual_keywords = [
        "bachelor", "master", "phd", "degree", "graduate", "b.tech", "m.tech", "btech", "mtech",
        "b.s.", "m.s.", "bsc", "msc", "mba", "certification", "certified", "diploma"
    ]
    qual_score = 0.0
    matched_quals = [k for k in qual_keywords if k in text_lower]
    if matched_quals:
        qual_score = min(100.0, 40.0 + len(matched_quals) * 15.0)

    # 2. Rewards (Achievements and Honors)
    reward_keywords = [
        "award", "reward", "honor", "scholarship", "winner", "achievement", "first place",
        "gold medal", "recognition", "outstanding", "dean's list", "prize"
    ]
    reward_score = 0.0
    matched_rewards = [k for k in reward_keywords if k in text_lower]
    if matched_rewards:
        reward_score = min(100.0, 40.0 + len(matched_rewards) * 15.0)

    # 3. Participation (Extracurriculars, hackathons, volunteering, leadership)
    part_keywords = [
        "volunteer", "hackathon", "participant", "participated", "member", "club", "society",
        "organized", "lead", "leadership", "speaker", "committee", "extracurricular"
    ]
    part_score = 0.0
    matched_parts = [k for k in part_keywords if k in text_lower]
    if matched_parts:
        part_score = min(100.0, 40.0 + len(matched_parts) * 15.0)

    return {
        "qualification_score": round(qual_score, 1),
        "rewards_score": round(reward_score, 1),
        "participation_score": round(part_score, 1),
    }


def analyze_resume_against_jd(resume_text: str, jd_text: str) -> dict:
    resume_skills = extract_skills(resume_text)
    jd_skills = extract_skills(jd_text)
    gap = compute_skill_gap(resume_skills, jd_skills)

    semantic_score = semantic_similarity(resume_text, jd_text)
    keyword_score = gap["skill_match_percent"]

    # Profile completeness factors (qualification, rewards, participation)
    profile_factors = evaluate_profile_factors(resume_text)
    q_score = profile_factors["qualification_score"]
    r_score = profile_factors["rewards_score"]
    p_score = profile_factors["participation_score"]

    ats_score = round(
        (semantic_score * SEMANTIC_WEIGHT) +
        (q_score * QUALIFICATION_WEIGHT) +
        (r_score * REWARDS_WEIGHT) +
        (p_score * PARTICIPATION_WEIGHT),
        1
    )

    return {
        "ats_score": ats_score,
        "semantic_similarity_score": semantic_score,
        "keyword_match_score": keyword_score,
        "qualification_score": q_score,
        "rewards_score": r_score,
        "participation_score": p_score,
        "resume_skills": resume_skills,
        "jd_skills": jd_skills,
        **gap,
    }
