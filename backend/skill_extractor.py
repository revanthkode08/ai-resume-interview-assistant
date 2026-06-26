"""
Extracts skills from a block of text by matching against SKILL_BANK_SET.
Uses simple word-boundary regex matching so "go" doesn't match inside "good",
and multi-word skills like "machine learning" are matched as phrases.
"""
import re
from skill_bank import SKILL_BANK_SET


def extract_skills(text: str) -> list[str]:
    text_lower = text.lower()
    found = []
    for skill in SKILL_BANK_SET:
        # escape special regex chars (e.g. c++, c#)
        pattern = r"(?<![a-z0-9])" + re.escape(skill) + r"(?![a-z0-9])"
        if re.search(pattern, text_lower):
            found.append(skill)
    return sorted(set(found))


def compute_skill_gap(resume_skills: list[str], jd_skills: list[str]) -> dict:
    resume_set = set(resume_skills)
    jd_set = set(jd_skills)

    matched = sorted(resume_set & jd_set)
    missing = sorted(jd_set - resume_set)
    extra = sorted(resume_set - jd_set)

    match_percent = round((len(matched) / len(jd_set)) * 100, 1) if jd_set else 0.0

    return {
        "matched_skills": matched,
        "missing_skills": missing,
        "extra_skills_in_resume": extra,
        "skill_match_percent": match_percent,
    }
