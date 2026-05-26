import os
import json
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, select, func
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///survey.db")
# Fix postgres:// URI for SQLAlchemy 1.4+
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite needs specific connect_args for threads
engine_kwargs = {}
if "sqlite" in DATABASE_URL:
    # Get absolute path for sqlite if it's the default
    if DATABASE_URL == "sqlite:///survey.db":
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "survey.db")
        DATABASE_URL = f"sqlite:///{db_path}"
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    section = Column(String, nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(String, nullable=False)
    options = Column(Text) # JSON string

class SurveySession(Base):
    __tablename__ = "sessions"
    session_id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed = Column(Integer, default=0)
    student_name = Column(String)
    student_grade = Column(Integer)
    student_section = Column(String)

class Response(Base):
    __tablename__ = "responses"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, ForeignKey("sessions.session_id", ondelete="CASCADE"))
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"))
    answer_text = Column(Text)

DEFAULT_QUESTIONS = [
    # Section A
    (1, "A", "Which best describes your usual role during classroom group work?", "mcq", 
     json.dumps({"a": "I usually take charge and guide the group", "b": "I share ideas but let others lead", "c": "I follow what the group decides", "d": "It depends on the subject or activity"})),
    (2, "A", "I feel confident speaking up and sharing my ideas during class discussions.", "mcq", 
     json.dumps({"a": "Strongly Agree", "b": "Agree", "c": "Neutral", "d": "Disagree", "e": "Strongly Disagree"})),
    (3, "A", "Which words describe how you see yourself in class? (Choose all that apply)", "checkbox", 
     json.dumps({"a": "A natural leader", "b": "A creative thinker", "c": "A problem solver", "d": "A hard worker", "e": "Still growing"})),
    (4, "A", "How would you describe your role in your classroom? What do you contribute most?", "open", None),
    (5, "A", "Describe a moment in class when you took initiative or helped your group. What happened?", "open", None),
    
    # Section B
    (6, "B", "What does your teacher most often say about your class participation?", "mcq", 
     json.dumps({"a": "They praise me for contributing and leading", "b": "They encourage me to participate more often", "c": "They say I am helpful to my classmates", "d": "They rarely give me specific feedback"})),
    (7, "B", "My teacher's feedback helps me grow as a learner and leader in class.", "mcq", 
     json.dumps({"a": "Strongly Agree", "b": "Agree", "c": "Neutral", "d": "Disagree", "e": "Strongly Disagree"})),
    (8, "B", "Has your teacher pointed out your leadership qualities during a classroom activity?", "mcq", 
     json.dumps({"a": "Yes, often", "b": "Sometimes", "c": "Not really"})),
    (9, "B", "What is the most encouraging thing your teacher has said about you in class? How did it affect you?", "open", None),
    (10, "B", "What do you wish your teacher or classmates would notice or say about you more often?", "open", None),
    
    # Section C
    (11, "C", "How do you usually feel when classroom activities or group work begin?", "mcq", 
     json.dumps({"a": "Ready and excited to take part", "b": "Okay-nothing special", "c": "A bit nervous or unsure", "d": "It really depends on the activity"})),
    (12, "C", "I feel safe to make mistakes and try new things in my classroom.", "mcq", 
     json.dumps({"a": "Strongly Agree", "b": "Agree", "c": "Neutral", "d": "Disagree", "e": "Strongly Disagree"})),
    (13, "C", "How happy are you in your classroom overall right now?", "mcq", 
     json.dumps({"a": "Very happy", "b": "Happy", "c": "Okay", "d": "Unhappy", "e": "Not happy"})),
    (14, "C", "What does your classroom do well that makes you feel supported as a learner and leader?", "open", None),
    (15, "C", "Is there anything about your classroom that makes you feel less confident? What would help?", "open", None),
    
    # Section D
    (16, "D", "Have you ever held a classroom leadership role?", "mcq", 
     json.dumps({"a": "Yes, I currently have one", "b": "Yes, I have had one before", "c": "No, but I would like one", "d": "No, and I'm not sure it interests me"})),
    (17, "D", "Which classroom leadership qualities do you already show? (Choose all that apply)", "checkbox", 
     json.dumps({
         "a": "I help classmates who don’t understand", 
         "b": "I suggest ideas in group work", 
         "c": "I make sure everyone has a turn", 
         "d": "I remind my group what we are supposed to do", 
         "e": "I help tidy up or set up without being asked", 
         "f": "I keep trying even when work is very hard", 
         "g": "I stay calm when things go wrong"
     })),
    (18, "D", "My classroom gives every student a fair chance to be a leader, not just the same few people.", "mcq", 
     json.dumps({"a": "Strongly Agree", "b": "Agree", "c": "Neutral", "d": "Disagree", "e": "Strongly Disagree"})),
    (19, "D", "Describe a time you led your group through a challenge in class. What did you do and what did you learn?", "open", None),
    (20, "D", "If you were given a leadership role in your class, what would you do to make your classroom better?", "open", None),
    
    # Section E
    (21, "E", "When you imagine yourself in a future class, how do you see yourself?", "mcq", 
     json.dumps({"a": "As a confident leader, others look up to", "b": "As someone more willing to speak up", "c": "Pretty much the same as I am now", "d": "I'm not sure-I'm still figuring it out"})),
    (22, "E", "I believe I can grow into a stronger classroom leader over the year.", "mcq", 
     json.dumps({"a": "Strongly Agree", "b": "Agree", "c": "Neutral", "d": "Disagree", "e": "Strongly Disagree"})),
    (23, "E", "Do you feel that classroom activities are preparing you to be a better leader in the future?", "mcq", 
     json.dumps({"a": "Yes, often", "b": "Sometimes", "c": "Not really"})),
    (24, "E", "What kind of classroom leader do you hope to be by the end of the year? What will you do differently?", "open", None),
    (25, "E", "Is there anything you would like your teacher to know about how you feel in class, or what would help you thrive?", "open", None)
]

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    count = db.query(Question).count()
    if count == 0:
        print("Pre-seeding default 25 questions into database...")
        for q in DEFAULT_QUESTIONS:
            db.add(Question(id=q[0], section=q[1], question_text=q[2], question_type=q[3], options=q[4]))
        db.commit()
    db.close()

def create_session(session_id: str, student_name: str, student_grade: int, student_section: str):
    db = SessionLocal()
    try:
        # Check if exists (ON CONFLICT DO UPDATE equivalent)
        session = db.query(SurveySession).filter_by(session_id=session_id).first()
        if session:
            session.student_name = student_name
            session.student_grade = student_grade
            session.student_section = student_section
        else:
            session = SurveySession(
                session_id=session_id,
                student_name=student_name,
                student_grade=student_grade,
                student_section=student_section
            )
            db.add(session)
        db.commit()
    finally:
        db.close()

def complete_session(session_id: str):
    db = SessionLocal()
    try:
        session = db.query(SurveySession).filter_by(session_id=session_id).first()
        if session:
            session.completed = 1
            db.commit()
    finally:
        db.close()

def save_response(session_id: str, question_id: int, answer_text: str):
    db = SessionLocal()
    try:
        response = db.query(Response).filter_by(session_id=session_id, question_id=question_id).first()
        if response:
            response.answer_text = answer_text
        else:
            response = Response(session_id=session_id, question_id=question_id, answer_text=answer_text)
            db.add(response)
        db.commit()
    finally:
        db.close()

def get_questions_from_db():
    db = SessionLocal()
    try:
        questions = db.query(Question).order_by(Question.id).all()
        result = {}
        for q in questions:
            result[q.id] = {
                "id": q.id,
                "section": q.section,
                "text": q.question_text,
                "type": q.question_type,
                "options": json.loads(q.options) if q.options else None
            }
        return result
    finally:
        db.close()

def update_question_in_db(q_id: int, text: str, options: dict = None):
    db = SessionLocal()
    try:
        q = db.query(Question).filter_by(id=q_id).first()
        if q:
            q.question_text = text
            q.options = json.dumps(options) if options else None
            db.commit()
    finally:
        db.close()

def get_completed_sessions_count(grade: int = None, section: str = None) -> int:
    db = SessionLocal()
    try:
        query = db.query(SurveySession).filter_by(completed=1)
        if grade is not None:
            query = query.filter_by(student_grade=grade)
        if section is not None and section.strip() != "":
            query = query.filter(func.upper(SurveySession.student_section) == func.upper(section.strip()))
        return query.count()
    finally:
        db.close()

def get_all_completed_responses(grade: int = None, section: str = None):
    db = SessionLocal()
    try:
        query = db.query(Response, SurveySession).join(SurveySession, Response.session_id == SurveySession.session_id).filter(SurveySession.completed == 1)
        
        if grade is not None:
            query = query.filter(SurveySession.student_grade == grade)
        if section is not None and section.strip() != "":
            query = query.filter(func.upper(SurveySession.student_section) == func.upper(section.strip()))
            
        rows = query.all()
        return [{"question_id": r.Response.question_id, "answer_text": r.Response.answer_text, "session_id": r.Response.session_id} for r in rows]
    finally:
        db.close()

def get_detailed_submissions(grade: int = None, section: str = None):
    db = SessionLocal()
    try:
        query = db.query(SurveySession).filter_by(completed=1)
        
        if grade is not None:
            query = query.filter_by(student_grade=grade)
        if section is not None and section.strip() != "":
            query = query.filter(func.upper(SurveySession.student_section) == func.upper(section.strip()))
            
        query = query.order_by(SurveySession.created_at.desc())
        sessions = query.all()
        
        submissions = []
        for s in sessions:
            responses = db.query(Response).filter_by(session_id=s.session_id).all()
            answers = {r.question_id: r.answer_text for r in responses}
            submissions.append({
                "session_id": s.session_id,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "student_name": s.student_name,
                "student_grade": s.student_grade,
                "student_section": s.student_section,
                "answers": answers
            })
            
        return submissions
    finally:
        db.close()
