"""
A curated skill keyword bank covering common tech + soft skills.
Used for simple, fast, explainable skill extraction (no heavy NER model needed,
which makes this easy to defend in a viva: "we use a curated domain dictionary
+ exact/fuzzy matching, not a black-box model, so results are explainable").
You can expand this list anytime — it's just data.
"""

SKILL_BANK = [
    # Programming languages
    "python", "java", "javascript", "typescript", "c++", "c", "c#", "go", "rust",
    "php", "ruby", "kotlin", "swift", "sql", "r", "scala",

    # Web / Frameworks
    "react", "react.js", "next.js", "node.js", "express", "express.js", "django",
    "flask", "fastapi", "spring", "spring boot", "angular", "vue", "vue.js",
    "html", "css", "tailwind", "bootstrap", "redux", "graphql", "rest api",
    "restful api", "websocket",

    # Data / ML / AI
    "machine learning", "deep learning", "nlp", "natural language processing",
    "computer vision", "tensorflow", "pytorch", "keras", "scikit-learn",
    "pandas", "numpy", "opencv", "huggingface", "transformers", "llm",
    "generative ai", "langchain", "data analysis", "data science",
    "data visualization", "statistics", "xgboost", "lightgbm",

    # Databases
    "mongodb", "mysql", "postgresql", "sqlite", "redis", "firebase",
    "elasticsearch", "cassandra", "oracle",

    # Cloud / DevOps
    "aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "ci/cd",
    "jenkins", "git", "github", "gitlab", "linux", "nginx", "terraform",
    "microservices", "serverless",

    # Tools / Other
    "jira", "agile", "scrum", "figma", "postman", "tableau", "power bi",
    "excel", "selenium", "junit", "pytest",

    # Soft skills
    "communication", "leadership", "teamwork", "problem solving",
    "time management", "critical thinking", "adaptability", "collaboration",
    "presentation", "project management", "mentoring", "stakeholder management",
]

# Normalize once for fast lookups
SKILL_BANK_SET = sorted(set(s.lower() for s in SKILL_BANK))
