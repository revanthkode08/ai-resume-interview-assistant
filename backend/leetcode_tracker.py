import urllib.request
import json
from datetime import datetime, timezone
from bson import ObjectId

LEETCODE_STATS_API = "https://leetcode-stats-api.herokuapp.com/"

def log_leetcode_problem(db, user_id, data):
    """Save a solved LeetCode problem log for the current user."""
    if db is None:
        raise RuntimeError("Database connection not available.")

    leetcode_logs = db["leetcode_logs"]

    problem_title = data.get("problem_title", "").strip()
    problem_url = data.get("problem_url", "").strip()
    difficulty = data.get("difficulty", "Easy").strip()
    topic = data.get("topic", "General").strip()
    notes = data.get("notes", "").strip()
    solution_code = data.get("solution_code", "").strip()

    if not problem_title:
        raise ValueError("Problem title is required.")

    log_doc = {
        "user_id": ObjectId(user_id),
        "problem_title": problem_title,
        "problem_url": problem_url,
        "difficulty": difficulty,  # Easy, Medium, Hard
        "topic": topic,
        "notes": notes,
        "solution_code": solution_code,
        "created_at": datetime.now(timezone.utc)
    }

    result = leetcode_logs.insert_one(log_doc)
    log_doc["_id"] = str(result.inserted_id)
    log_doc["user_id"] = str(log_doc["user_id"])
    log_doc["created_at"] = log_doc["created_at"].isoformat()
    return log_doc


def get_leetcode_logs(db, user_id):
    """Fetch all logged LeetCode problems for a user."""
    if db is None:
        return []

    leetcode_logs = db["leetcode_logs"]
    records = list(leetcode_logs.find({"user_id": ObjectId(user_id)}).sort("created_at", -1))
    
    for r in records:
        r["_id"] = str(r["_id"])
        r["user_id"] = str(r["user_id"])
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = r["created_at"].isoformat()
            
    return records


def delete_leetcode_log(db, user_id, log_id):
    """Delete a logged LeetCode problem."""
    if db is None:
        raise RuntimeError("Database connection not available.")

    leetcode_logs = db["leetcode_logs"]
    result = leetcode_logs.delete_one({"_id": ObjectId(log_id), "user_id": ObjectId(user_id)})
    return result.deleted_count > 0


def get_leetcode_stats(db, user_id):
    """Aggregate local stats of logged LeetCode problems."""
    if db is None:
        return {"total": 0, "easy": 0, "medium": 0, "hard": 0, "topics": {}}

    leetcode_logs = db["leetcode_logs"]
    logs = list(leetcode_logs.find({"user_id": ObjectId(user_id)}))

    easy_count = 0
    medium_count = 0
    hard_count = 0
    topics = {}

    for log in logs:
        diff = log.get("difficulty", "Easy")
        if diff == "Easy":
            easy_count += 1
        elif diff == "Medium":
            medium_count += 1
        elif diff == "Hard":
            hard_count += 1

        topic = log.get("topic", "General").strip()
        if topic:
            topics[topic] = topics.get(topic, 0) + 1

    return {
        "total": len(logs),
        "easy": easy_count,
        "medium": medium_count,
        "hard": hard_count,
        "topics": topics
    }


def fetch_external_leetcode_stats(username):
    """Fetch statistics from LeetCode public unofficial API."""
    url = f"{LEETCODE_STATS_API}{username}"
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                data = json.loads(response.read().decode())
                if data.get("status") == "success":
                    return {
                        "status": "success",
                        "total_solved": data.get("totalSolved", 0),
                        "easy_solved": data.get("easySolved", 0),
                        "medium_solved": data.get("mediumSolved", 0),
                        "hard_solved": data.get("hardSolved", 0),
                        "acceptance_rate": data.get("acceptanceRate", 0),
                        "ranking": data.get("ranking", 0),
                        "contribution_points": data.get("contributionPoints", 0),
                        "reputation": data.get("reputation", 0)
                    }
                else:
                    return {"status": "error", "message": data.get("message", "User not found.")}
    except Exception as e:
        print(f"[LEETCODE] Failed to fetch external stats: {e}")
        return {"status": "error", "message": f"Could not connect to LeetCode API. Detail: {str(e)}"}
