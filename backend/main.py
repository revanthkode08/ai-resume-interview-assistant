from dotenv import load_dotenv
load_dotenv()
import os
from datetime import datetime, timezone

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pymongo import MongoClient
from bson import ObjectId

from resume_parser import extract_text
from ats_scorer import analyze_resume_against_jd
from interview_questions import generate_interview_questions
from auth import (
    hash_password, verify_password,
    create_access_token, decode_token,
    get_current_user, bearer_scheme,
)
from skill_extractor import extract_skills
from jobs_engine import seed_default_jobs, get_recommended_jobs
from voice_bot import start_mock_interview, respond_mock_interview
import leetcode_tracker

app = FastAPI(title="AI Resume & Interview Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── MongoDB setup ─────────────────────────────────────────────────────────────

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "resume_assistant")

try:
    mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
    mongo_client.admin.command("ping")
    db = mongo_client[DB_NAME]
    users_col = db["users"]
    history_col = db["analysis_history"]
    MONGO_AVAILABLE = True
    # Ensure indexes
    users_col.create_index("email", unique=True)
except Exception as e:
    MONGO_AVAILABLE = False
    db = users_col = history_col = None


# ── Seed default admin on startup ─────────────────────────────────────────────

def seed_admin():
    if not MONGO_AVAILABLE:
        return
    admin_email = os.getenv("ADMIN_EMAIL", "admin@resumeai.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "Admin@123456")
    admin_name = os.getenv("ADMIN_NAME", "Super Admin")

    existing = users_col.find_one({"email": admin_email})
    if not existing:
        users_col.insert_one({
            "name": admin_name,
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "role": "admin",
            "created_at": datetime.now(timezone.utc),
        })
        print(f"[AUTH] Default admin created — email: {admin_email}  password: {admin_password}")
    else:
        print(f"[AUTH] Admin already exists: {admin_email}")

seed_admin()

if MONGO_AVAILABLE:
    try:
        seed_default_jobs(db)
    except Exception as e:
        print(f"[STARTUP] Seeding default jobs failed: {e}")


# ── Auth helpers ──────────────────────────────────────────────────────────────

def require_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
):
    """Decodes token, fetches user from DB, returns user dict."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required.")
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id or not MONGO_AVAILABLE:
        raise HTTPException(status_code=401, detail="Invalid token.")
    user = users_col.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")
    return user


def require_admin(user=Depends(require_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    return user


def serialize_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "name": user.get("name", ""),
        "email": user["email"],
        "role": user.get("role", "user"),
        "created_at": user.get("created_at", "").isoformat() if user.get("created_at") else None,
    }


# ── Auth routes ───────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "mongo_connected": MONGO_AVAILABLE}


@app.post("/api/auth/register")
def register(name: str = Form(...), email: str = Form(...), password: str = Form(...)):
    if not MONGO_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available.")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    existing = users_col.find_one({"email": email.lower().strip()})
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user_doc = {
        "name": name.strip(),
        "email": email.lower().strip(),
        "password_hash": hash_password(password),
        "role": "user",
        "created_at": datetime.now(timezone.utc),
    }
    result = users_col.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id
    token = create_access_token({"sub": str(result.inserted_id)})
    return {"access_token": token, "token_type": "bearer", "user": serialize_user(user_doc)}


@app.post("/api/auth/login")
def login(email: str = Form(...), password: str = Form(...)):
    if not MONGO_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available.")
    user = users_col.find_one({"email": email.lower().strip()})
    if not user or not verify_password(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = create_access_token({"sub": str(user["_id"])})
    return {"access_token": token, "token_type": "bearer", "user": serialize_user(user)}


@app.get("/api/auth/me")
def me(user=Depends(require_user)):
    return serialize_user(user)


# ── Resume / Analysis routes (protected) ──────────────────────────────────────

@app.post("/api/parse-resume")
async def parse_resume(
    file: UploadFile = File(...),
    user=Depends(require_user),
):
    file_bytes = await file.read()
    try:
        text = extract_text(file.filename, file_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse file. It may be corrupted or an unsupported format. Error: {str(e)}"
        )
    if not text.strip():
        raise HTTPException(
            status_code=400,
            detail="Could not extract any text. The file may be a scanned image — try a text-based PDF.",
        )
        
    # Save the parsed text and extracted skills to the user profile
    if MONGO_AVAILABLE:
        try:
            skills = extract_skills(text)
            users_col.update_one(
                {"_id": user["_id"]},
                {"$set": {
                    "resume_text": text,
                    "skills": skills,
                    "resume_filename": file.filename,
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
        except Exception as e:
            print(f"[PARSE RESUME] Failed to save skills to user profile: {e}")
            
    return {"filename": file.filename, "resume_text": text}


@app.post("/api/analyze")
async def analyze(
    resume_text: str = Form(...),
    jd_text: str = Form(...),
    user=Depends(require_user),
):
    if not resume_text.strip() or not jd_text.strip():
        raise HTTPException(status_code=400, detail="Resume text and job description are both required.")

    result = analyze_resume_against_jd(resume_text, jd_text)

    if MONGO_AVAILABLE:
        # Save latest analyze text and extracted skills to user profile
        try:
            skills = extract_skills(resume_text)
            users_col.update_one(
                {"_id": user["_id"]},
                {"$set": {
                    "resume_text": resume_text,
                    "skills": skills,
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
        except Exception as e:
            print(f"[ANALYZE] Failed to save skills to user profile: {e}")

        history_col.insert_one({
            "user_id": user["_id"],
            "type": "analysis",
            "ats_score": result["ats_score"],
            "semantic_similarity_score": result.get("semantic_similarity_score"),
            "keyword_match_score": result.get("keyword_match_score"),
            "qualification_score": result.get("qualification_score", 0.0),
            "rewards_score": result.get("rewards_score", 0.0),
            "participation_score": result.get("participation_score", 0.0),
            "matched_skills": result.get("matched_skills", []),
            "missing_skills": result.get("missing_skills", []),
            "created_at": datetime.now(timezone.utc),
        })

    return result


@app.post("/api/interview-questions")
async def interview_questions(
    resume_text: str = Form(...),
    jd_text: str = Form(...),
    user=Depends(require_user),
):
    if not resume_text.strip() or not jd_text.strip():
        raise HTTPException(status_code=400, detail="Resume text and job description are both required.")

    try:
        questions = generate_interview_questions(resume_text, jd_text)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        try:
            from groq import APIError
            if isinstance(e, APIError):
                s = e.status_code if hasattr(e, "status_code") else 500
                raise HTTPException(status_code=s, detail=f"Groq API Error: {str(e)}")
        except ImportError:
            pass
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

    if MONGO_AVAILABLE:
        history_col.insert_one({
            "user_id": user["_id"],
            "type": "interview_questions",
            "created_at": datetime.now(timezone.utc),
        })

    return questions


@app.get("/api/history")
def get_history(limit: int = 20, user=Depends(require_user)):
    if not MONGO_AVAILABLE:
        return {"history": [], "note": "MongoDB not connected."}
    records = list(
        history_col.find(
            {"user_id": user["_id"]}, {"_id": 0, "user_id": 0}
        ).sort("created_at", -1).limit(limit)
    )
    # Serialize datetimes
    for r in records:
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = r["created_at"].isoformat()
    return {"history": records}


# ── Admin routes ──────────────────────────────────────────────────────────────

@app.get("/api/admin/stats")
def admin_stats(admin=Depends(require_admin)):
    if not MONGO_AVAILABLE:
        return {}
    total_users = users_col.count_documents({"role": "user"})
    total_analyses = history_col.count_documents({"type": "analysis"})
    total_questions = history_col.count_documents({"type": "interview_questions"})
    avg_score_pipeline = [
        {"$match": {"type": "analysis", "ats_score": {"$exists": True}}},
        {"$group": {"_id": None, "avg": {"$avg": "$ats_score"}}},
    ]
    avg_result = list(history_col.aggregate(avg_score_pipeline))
    avg_score = round(avg_result[0]["avg"], 1) if avg_result else 0
    return {
        "total_users": total_users,
        "total_analyses": total_analyses,
        "total_questions": total_questions,
        "avg_ats_score": avg_score,
    }


@app.get("/api/admin/users")
def admin_users(admin=Depends(require_admin)):
    if not MONGO_AVAILABLE:
        return {"users": []}
    users = list(users_col.find({}, {"password_hash": 0}).sort("created_at", -1).limit(200))
    result = []
    for u in users:
        uid = u["_id"]
        analyses = history_col.count_documents({"user_id": uid, "type": "analysis"})
        questions = history_col.count_documents({"user_id": uid, "type": "interview_questions"})
        last = history_col.find_one({"user_id": uid}, sort=[("created_at", -1)])
        entry = serialize_user(u)
        entry["analyses_count"] = analyses
        entry["questions_count"] = questions
        entry["last_active"] = last["created_at"].isoformat() if last and isinstance(last.get("created_at"), datetime) else None
        result.append(entry)
    return {"users": result}


@app.get("/api/admin/recent-activity")
def admin_recent_activity(admin=Depends(require_admin), limit: int = 20):
    if not MONGO_AVAILABLE:
        return {"activity": []}
    records = list(
        history_col.find({}).sort("created_at", -1).limit(limit)
    )
    result = []
    for r in records:
        user = users_col.find_one({"_id": r.get("user_id")}, {"name": 1, "email": 1})
        result.append({
            "type": r.get("type"),
            "ats_score": r.get("ats_score"),
            "created_at": r["created_at"].isoformat() if isinstance(r.get("created_at"), datetime) else None,
            "user_name": user.get("name") if user else "Unknown",
            "user_email": user.get("email") if user else "Unknown",
        })
    return {"activity": result}


# ── Jobs Recommendations Routes ───────────────────────────────────────────────

@app.get("/api/jobs/recommendations")
def recommendations(user=Depends(require_user)):
    if not MONGO_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available.")
    return get_recommended_jobs(db, user)


# ── Voice Bot Routes ──────────────────────────────────────────────────────────

@app.post("/api/voice-bot/start")
def start_interview(
    role: str = Form(...),
    category: str = Form(...),
    num_questions: int = Form(3),
    user=Depends(require_user)
):
    try:
        return start_mock_interview(db, user, role, category, num_questions)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/voice-bot/respond")
def respond_interview(
    session_id: str = Form(...),
    user_answer: str = Form(...),
    user=Depends(require_user)
):
    try:
        return respond_mock_interview(db, session_id, user_answer)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/voice-bot/history")
def get_voice_history(user=Depends(require_user)):
    if not MONGO_AVAILABLE:
        return {"history": []}
    
    mock_interviews = db["mock_interviews"]
    records = list(
        mock_interviews.find(
            {"user_id": user["_id"], "status": "completed"}, 
            {"_id": 1, "role": 1, "category": 1, "feedback.score": 1, "completed_at": 1}
        ).sort("completed_at", -1)
    )
    
    result = []
    for r in records:
        result.append({
            "session_id": str(r["_id"]),
            "role": r.get("role"),
            "category": r.get("category"),
            "score": r.get("feedback", {}).get("score", 0) if r.get("feedback") else 0,
            "completed_at": r["completed_at"].isoformat() if isinstance(r.get("completed_at"), datetime) else None
        })
    return {"history": result}


@app.get("/api/voice-bot/session/{session_id}")
def get_voice_session(session_id: str, user=Depends(require_user)):
    if not MONGO_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available.")
    
    mock_interviews = db["mock_interviews"]
    session = mock_interviews.find_one({"_id": ObjectId(session_id), "user_id": user["_id"]})
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found.")
    
    # Serialize ObjectId
    session["_id"] = str(session["_id"])
    session["user_id"] = str(session["user_id"])
    if isinstance(session.get("created_at"), datetime):
        session["created_at"] = session["created_at"].isoformat()
    if isinstance(session.get("completed_at"), datetime):
        session["completed_at"] = session["completed_at"].isoformat()
        
    return session


# ── LeetCode Tracker Routes ───────────────────────────────────────────────────

@app.post("/api/leetcode/log")
def log_leetcode(
    problem_title: str = Form(...),
    problem_url: str = Form(""),
    difficulty: str = Form("Easy"),
    topic: str = Form("General"),
    notes: str = Form(""),
    solution_code: str = Form(""),
    user=Depends(require_user)
):
    data = {
        "problem_title": problem_title,
        "problem_url": problem_url,
        "difficulty": difficulty,
        "topic": topic,
        "notes": notes,
        "solution_code": solution_code
    }
    try:
        return leetcode_tracker.log_leetcode_problem(db, user["_id"], data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/leetcode/logs")
def get_leetcode_history(user=Depends(require_user)):
    return leetcode_tracker.get_leetcode_logs(db, user["_id"])


@app.delete("/api/leetcode/log/{log_id}")
def delete_leetcode(log_id: str, user=Depends(require_user)):
    try:
        success = leetcode_tracker.delete_leetcode_log(db, user["_id"], log_id)
        if not success:
            raise HTTPException(status_code=404, detail="Log not found or unauthorized.")
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/leetcode/stats")
def get_leetcode_aggregates(user=Depends(require_user)):
    return leetcode_tracker.get_leetcode_stats(db, user["_id"])


@app.get("/api/leetcode/external/{username}")
def sync_leetcode_external(username: str, user=Depends(require_user)):
    res = leetcode_tracker.fetch_external_leetcode_stats(username)
    if res.get("status") == "success":
        # Save username to user profile
        if MONGO_AVAILABLE:
            users_col.update_one(
                {"_id": user["_id"]},
                {"$set": {"leetcode_username": username}}
            )
    return res
