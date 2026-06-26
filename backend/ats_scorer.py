"""
ATS Score = blend of:
  1. Semantic similarity between resume text and JD text (Sentence-Transformers + cosine similarity)
  2. Skill keyword overlap percentage (explainable, matches what real ATS systems do)

Final score is a weighted average. This dual approach is a good viva talking point:
"semantic similarity alone can be gamed by buzzword stuffing, and keyword
matching alone misses synonyms/paraphrased experience, so we combine both."
"""
from functools import lru_cache
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer

from skill_extractor import extract_skills, compute_skill_gap

SEMANTIC_WEIGHT = 0.6
KEYWORD_WEIGHT = 0.4


def semantic_similarity(resume_text: str, jd_text: str) -> float:
    # Handle empty text defensive checks
    if not resume_text.strip() or not jd_text.strip():
        return 0.0

    # TF-IDF Vectorizer with stop words removal
    vectorizer = TfidfVectorizer(stop_words='english')
    try:
        tfidf = vectorizer.fit_transform([resume_text, jd_text])
        # Cosine similarity between resume (index 0) and jd (index 1)
        sim = float(cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0])
    except Exception:
        return 0.0

    # Scale similarity to 0..100
    sim = max(0.0, min(1.0, sim))
    return round(sim * 100, 1)


def analyze_resume_against_jd(resume_text: str, jd_text: str) -> dict:
    resume_skills = extract_skills(resume_text)
    jd_skills = extract_skills(jd_text)
    gap = compute_skill_gap(resume_skills, jd_skills)

    semantic_score = semantic_similarity(resume_text, jd_text)
    keyword_score = gap["skill_match_percent"]

    ats_score = round(
        (semantic_score * SEMANTIC_WEIGHT) + (keyword_score * KEYWORD_WEIGHT), 1
    )

    return {
        "ats_score": ats_score,
        "semantic_similarity_score": semantic_score,
        "keyword_match_score": keyword_score,
        "resume_skills": resume_skills,
        "jd_skills": jd_skills,
        **gap,
    }
