import os
from datetime import datetime, timezone
from bson import ObjectId
from skill_extractor import extract_skills, compute_skill_gap
from groq import Groq

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
MODEL_NAME = "llama-3.3-70b-versatile"

DEFAULT_JOBS = [
    {
        "title": "Frontend Developer (React)",
        "company": "TechVibe Solutions",
        "location": "San Francisco, CA (Hybrid)",
        "salary": "$110,000 - $140,000",
        "experience_level": "Mid",
        "description": "We are seeking a talented React Developer to build premium web applications. You will work on responsive layouts, state management with Redux, and integration with REST APIs. Strong knowledge of CSS, Tailwind, TypeScript, and HTML is required.",
        "skills": ["react", "javascript", "typescript", "css", "tailwind", "html", "redux", "rest api"],
    },
    {
        "title": "Backend Software Engineer (Node.js)",
        "company": "DataStream Corp",
        "location": "Austin, TX (Remote)",
        "salary": "$120,000 - $150,000",
        "experience_level": "Mid-Senior",
        "description": "Join our backend infrastructure team. You will design scalability microservices, manage databases like MongoDB and PostgreSQL, use Redis for caching, and maintain robust APIs. Knowledge of Node.js, Express, Docker, and CI/CD pipelines is essential.",
        "skills": ["node.js", "express", "mongodb", "postgresql", "redis", "docker", "ci/cd", "microservices"],
    },
    {
        "title": "Machine Learning Engineer",
        "company": "AlphaAI Labs",
        "location": "New York, NY (On-site)",
        "salary": "$150,000 - $190,000",
        "experience_level": "Senior",
        "description": "We are looking for a Senior ML Engineer to build, evaluate, and scale generative AI products. Experience with PyTorch, Transformers, LLMs, LangChain, vector databases (ChromaDB), and deployment via FastAPI is highly valued. Strong Python skills are a must.",
        "skills": ["python", "machine learning", "deep learning", "pytorch", "transformers", "llm", "generative ai", "langchain", "fastapi"],
    },
    {
        "title": "Fullstack Developer",
        "company": "LaunchPad Startups",
        "location": "Remote (US/Canada)",
        "salary": "$90,000 - $125,000",
        "experience_level": "Entry-Mid",
        "description": "Looking for a versatile fullstack developer to help scale our products. You will work with React on the frontend, Python/FastAPI on the backend, and PostgreSQL for storage. Experience with Git, GitHub, and cloud hosting (AWS/GCP) is required.",
        "skills": ["react", "python", "fastapi", "postgresql", "git", "github", "aws", "javascript"],
    },
    {
        "title": "DevOps & Cloud Engineer",
        "company": "CloudShield Security",
        "location": "Seattle, WA (Hybrid)",
        "salary": "$130,000 - $165,000",
        "experience_level": "Senior",
        "description": "Scale our cloud operations. We are looking for an expert in AWS, Docker, Kubernetes, and Terraform to automate provisioning. You will set up CI/CD pipelines using Jenkins/GitLab CI and maintain Linux servers with high security protocols.",
        "skills": ["aws", "docker", "kubernetes", "terraform", "ci/cd", "jenkins", "gitlab", "linux"],
    },
    {
        "title": "Python Data Scientist",
        "company": "Insight Analytics",
        "location": "Chicago, IL (Hybrid)",
        "salary": "$115,000 - $145,000",
        "experience_level": "Mid",
        "description": "Derive actionable insights from complex datasets. You will write code in Python, use libraries like Pandas, NumPy, Scikit-Learn, and XGBoost to build statistical models, and present findings using data visualization tools like Tableau or Power BI.",
        "skills": ["python", "pandas", "numpy", "scikit-learn", "xgboost", "statistics", "data analysis", "tableau", "power bi"],
    },
    {
        "title": "Mobile App Developer (iOS & Android)",
        "company": "AppFlow Systems",
        "location": "Los Angeles, CA (Remote)",
        "salary": "$105,000 - $135,000",
        "experience_level": "Mid",
        "description": "Design and build beautiful native mobile apps. Looking for experience in Kotlin, Swift, or cross-platform framework React Native. Must understand REST APIs, push notifications, and mobile storage systems (SQLite).",
        "skills": ["kotlin", "swift", "react", "javascript", "sqlite", "rest api", "git", "figma"],
    },
    {
        "title": "Technical Product Manager",
        "company": "CoreTech Software",
        "location": "Boston, MA (Hybrid)",
        "salary": "$125,000 - $160,000",
        "experience_level": "Mid-Senior",
        "description": "Lead the lifecycle of developer-facing APIs and platforms. Work closely with software engineers, use agile methodologies, run scrum sprint ceremonies, manage roadmaps in Jira, and communicate features clearly to non-technical stakeholders.",
        "skills": ["agile", "scrum", "jira", "communication", "leadership", "project management", "rest api", "data analysis"],
    }
]


def seed_default_jobs(db):
    """Seed sample jobs if none exist in the database."""
    if db is None:
        return
    jobs_col = db["jobs"]
    if jobs_col.count_documents({}) == 0:
        for job in DEFAULT_JOBS:
            job["created_at"] = datetime.now(timezone.utc)
            jobs_col.insert_one(job)
        print(f"[JOBS] Seeded {len(DEFAULT_JOBS)} default jobs.")
    else:
        print("[JOBS] Jobs already seeded.")


def generate_fit_analysis(job_title, matched_skills, missing_skills):
    """Generate a brief explanation of job fit using Groq."""
    if not GROQ_API_KEY:
        return f"Matched: {', '.join(matched_skills[:3])}. Missing: {', '.join(missing_skills[:3])}."
    
    prompt = f"""You are a helpful career advisor.
Briefly describe in exactly one short sentence (max 25 words) why this candidate is a fit or what key skills they need to focus on to get hired for the job.

Job Title: {job_title}
Candidate's Matched Skills: {', '.join(matched_skills)}
Candidate's Missing Skills: {', '.join(missing_skills)}

Example Response: "You have strong React and Javascript skills matching 80% of the job, but learning Redux will make you a perfect fit."
"""
    try:
        client = Groq(api_key=GROQ_API_KEY)
        response = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=MODEL_NAME,
            max_tokens=60,
            temperature=0.3
        )
        return response.choices[0].message.content.strip().replace('"', '')
    except Exception as e:
        print(f"[JOBS] Groq fit analysis failed: {e}")
        return f"Your background matches {len(matched_skills)} skills, but you need {', '.join(missing_skills[:2])} for a complete match."


def get_recommended_jobs(db, user):
    """Calculate recommendations for the given user's skills."""
    if db is None:
        return {"recommendations": [], "status": "no_db"}

    jobs_col = db["jobs"]
    user_skills = user.get("skills", [])
    
    # If user hasn't uploaded a resume, we return jobs with 0 score and a notice
    if not user_skills:
        all_jobs = list(jobs_col.find({}))
        results = []
        for job in all_jobs:
            results.append({
                "id": str(job["_id"]),
                "title": job["title"],
                "company": job["company"],
                "location": job["location"],
                "salary": job["salary"],
                "experience_level": job["experience_level"],
                "description": job["description"],
                "required_skills": job["skills"],
                "match_score": 0.0,
                "matched_skills": [],
                "missing_skills": job["skills"],
                "fit_reasoning": "Upload your resume in the analyzer to see your match analysis!"
            })
        return {"recommendations": results, "has_resume": False}

    all_jobs = list(jobs_col.find({}))
    recommendations = []
    
    for job in all_jobs:
        job_skills = job.get("skills", [])
        gap = compute_skill_gap(user_skills, job_skills)
        match_score = gap["skill_match_percent"]
        
        # Select first 3 missing and matched to build a quick explanation
        matched_list = gap["matched_skills"]
        missing_list = gap["missing_skills"]
        
        # Only call LLM if score is > 0 to save calls, otherwise use simple message
        if match_score > 0:
            fit_reasoning = generate_fit_analysis(job["title"], matched_list, missing_list)
        else:
            fit_reasoning = "None of your current resume skills match this job. Consider adding relevant technical projects to bridge the gap."
            
        recommendations.append({
            "id": str(job["_id"]),
            "title": job["title"],
            "company": job["company"],
            "location": job["location"],
            "salary": job["salary"],
            "experience_level": job["experience_level"],
            "description": job["description"],
            "required_skills": job_skills,
            "match_score": match_score,
            "matched_skills": matched_list,
            "missing_skills": missing_list,
            "fit_reasoning": fit_reasoning
        })
        
    # Sort recommendations descending by match score
    recommendations.sort(key=lambda x: x["match_score"], reverse=True)
    return {"recommendations": recommendations, "has_resume": True}
