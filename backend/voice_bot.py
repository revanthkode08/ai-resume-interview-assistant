import os
import json
from datetime import datetime, timezone
from bson import ObjectId
from groq import Groq

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
MODEL_NAME = "llama-3.3-70b-versatile"

START_PROMPT_TEMPLATE = """You are a professional technical mock interviewer.
The candidate is practicing for the role of: {role} (Interview type: {category}).
Here is their resume/background context if available:
{resume_context}

Please start the interview by welcoming the candidate and asking the first interview question.
Keep the question clear, engaging, and professional.
Crucial: Keep your response short, natural, and conversational (under 50 words) because this text will be read aloud by a text-to-speech voice synthesizer. Do not include markdown, checklists, or any text other than what you would say directly to the candidate.
"""

CONVERSE_PROMPT_TEMPLATE = """You are a professional technical mock interviewer.
You are interviewing a candidate for the role of: {role} (Interview type: {category}).

Below is the chat history so far:
{chat_history}

The candidate has just answered: "{user_answer}"

Acknowledge their answer briefly with professional feedback (e.g. "Good explanation", "Interesting approach", or a brief follow-up check) and then ask the NEXT interview question.
Crucial: Keep your response short, natural, and conversational (under 60 words) because this text will be read aloud. Do not add markdown or metadata. Just output the dialogue.
"""

EVALUATE_PROMPT_TEMPLATE = """You are an expert technical interviewer and talent evaluator.
Review the complete chat history of a mock interview between the candidate and the AI interviewer for the role: {role} ({category}).

Chat History:
{chat_history}

Please analyze the candidate's performance across all answers and generate a detailed structured evaluation.
Return ONLY valid JSON (no markdown wrapper, no conversational text, no commentary) in exactly this shape:
{{
  "score": 85,
  "feedback_summary": "Provide a 2-3 sentence summary of how the candidate performed overall.",
  "strengths": [
    "Highlight specific strengths in technical accuracy, problem-solving, communication or structure."
  ],
  "weaknesses": [
    "Highlight specific areas for improvement, missing concepts, or communication gaps."
  ],
  "question_breakdown": [
    {{
      "question": "The question asked by the interviewer",
      "answer": "The answer given by the candidate",
      "score": 80,
      "critique": "A detailed 1-2 sentence critique of their answer and what they could have added or done better."
    }}
  ]
}}

Rules:
- The "score" must be an integer between 0 and 100.
- Make the critique constructive, specific, and actionable.
- Ensure the JSON is valid and can be directly loaded.
"""


def start_mock_interview(db, user, role, category, num_questions=3):
    """Start a mock interview session, save to DB, and return the first question."""
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not configured.")

    if db is None:
        raise RuntimeError("Database connection not available.")

    mock_interviews = db["mock_interviews"]

    # Extract resume context
    resume_context = user.get("resume_text", "No resume uploaded. Interviewing based on standard profile.")
    if len(resume_context) > 4000:
        resume_context = resume_context[:4000] + "..."

    # Generate first question using Groq
    prompt = START_PROMPT_TEMPLATE.format(
        role=role,
        category=category,
        resume_context=resume_context
    )

    client = Groq(api_key=GROQ_API_KEY)
    response = client.chat.completions.create(
        messages=[{"role": "user", "content": prompt}],
        model=MODEL_NAME,
        temperature=0.7,
        max_tokens=150
    )
    first_question = response.choices[0].message.content.strip()

    # Create session document
    session = {
        "user_id": user["_id"],
        "role": role,
        "category": category,
        "num_questions": num_questions,
        "status": "in_progress",
        "chat_history": [
            {"role": "assistant", "content": first_question}
        ],
        "created_at": datetime.now(timezone.utc),
    }

    result = mock_interviews.insert_one(session)
    return {
        "session_id": str(result.inserted_id),
        "question": first_question,
        "progress": 1,
        "num_questions": num_questions,
        "status": "in_progress"
    }


def respond_mock_interview(db, session_id, user_answer):
    """Receive user answer, update chat, and return the next question or final evaluation."""
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not configured.")

    if db is None:
        raise RuntimeError("Database connection not available.")

    mock_interviews = db["mock_interviews"]
    session = mock_interviews.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise ValueError("Interview session not found.")

    if session["status"] == "completed":
        return {
            "status": "completed",
            "feedback": session.get("feedback")
        }

    chat_history = session.get("chat_history", [])
    chat_history.append({"role": "user", "content": user_answer})

    # Count how many questions have been asked (assistant messages)
    questions_asked = sum(1 for m in chat_history if m["role"] == "assistant")
    num_questions = session.get("num_questions", 3)

    client = Groq(api_key=GROQ_API_KEY)

    if questions_asked < num_questions:
        # Format the chat history for prompt
        history_str = ""
        for msg in chat_history:
            sender = "Interviewer" if msg["role"] == "assistant" else "Candidate"
            history_str += f"{sender}: {msg['content']}\n"

        prompt = CONVERSE_PROMPT_TEMPLATE.format(
            role=session["role"],
            category=session["category"],
            chat_history=history_str,
            user_answer=user_answer
        )

        response = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=MODEL_NAME,
            temperature=0.7,
            max_tokens=150
        )
        next_question = response.choices[0].message.content.strip()
        chat_history.append({"role": "assistant", "content": next_question})

        mock_interviews.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {"chat_history": chat_history}}
        )

        return {
            "session_id": session_id,
            "question": next_question,
            "progress": questions_asked + 1,
            "num_questions": num_questions,
            "status": "in_progress"
        }
    else:
        # Generate evaluation report
        history_str = ""
        for msg in chat_history:
            sender = "Interviewer" if msg["role"] == "assistant" else "Candidate"
            history_str += f"{sender}: {msg['content']}\n"

        prompt = EVALUATE_PROMPT_TEMPLATE.format(
            role=session["role"],
            category=session["category"],
            chat_history=history_str
        )

        response = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=MODEL_NAME,
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        raw_feedback = response.choices[0].message.content.strip()

        # Clean raw response if wrap in ```json
        if raw_feedback.startswith("```"):
            raw_feedback = raw_feedback.strip("`")
            if raw_feedback.lower().startswith("json"):
                raw_feedback = raw_feedback[4:].strip()

        try:
            feedback_data = json.loads(raw_feedback)
        except Exception:
            # Fallback formatting if JSON parsing fails
            feedback_data = {
                "score": 75,
                "feedback_summary": "Interview completed. Structured evaluation failed to parse, see raw history.",
                "strengths": ["Completed mock interview session"],
                "weaknesses": ["Unable to parse AI critique details"],
                "question_breakdown": []
            }

        mock_interviews.update_one(
            {"_id": ObjectId(session_id)},
            {
                "$set": {
                    "chat_history": chat_history,
                    "status": "completed",
                    "feedback": feedback_data,
                    "completed_at": datetime.now(timezone.utc)
                }
            }
        )

        return {
            "session_id": session_id,
            "status": "completed",
            "feedback": feedback_data
        }
