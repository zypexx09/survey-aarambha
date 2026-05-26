const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const DEFAULT_QUESTIONS = [
  // Section A
  [1, "A", "Which best describes your usual role during classroom group work?", "mcq", 
   JSON.stringify({"a": "I usually take charge and guide the group", "b": "I share ideas but let others lead", "c": "I follow what the group decides", "d": "It depends on the subject or activity"})],
  [2, "A", "I feel confident speaking up and sharing my ideas during class discussions.", "mcq", 
   JSON.stringify({"a": "Strongly Agree", "b": "Agree", "c": "Neutral", "d": "Disagree", "e": "Strongly Disagree"})],
  [3, "A", "Which words describe how you see yourself in class? (Choose all that apply)", "checkbox", 
   JSON.stringify({"a": "A natural leader", "b": "A creative thinker", "c": "A problem solver", "d": "A hard worker", "e": "Still growing"})],
  [4, "A", "How would you describe your role in your classroom? What do you contribute most?", "open", null],
  [5, "A", "Describe a moment in class when you took initiative or helped your group. What happened?", "open", null],
  
  // Section B
  [6, "B", "What does your teacher most often say about your class participation?", "mcq", 
   JSON.stringify({"a": "They praise me for contributing and leading", "b": "They encourage me to participate more often", "c": "They say I am helpful to my classmates", "d": "They rarely give me specific feedback"})],
  [7, "B", "My teacher's feedback helps me grow as a learner and leader in class.", "mcq", 
   JSON.stringify({"a": "Strongly Agree", "b": "Agree", "c": "Neutral", "d": "Disagree", "e": "Strongly Disagree"})],
  [8, "B", "Has your teacher pointed out your leadership qualities during a classroom activity?", "mcq", 
   JSON.stringify({"a": "Yes, often", "b": "Sometimes", "c": "Not really"})],
  [9, "B", "What is the most encouraging thing your teacher has said about you in class? How did it affect you?", "open", null],
  [10, "B", "What do you wish your teacher or classmates would notice or say about you more often?", "open", null],
  
  // Section C
  [11, "C", "How do you usually feel when classroom activities or group work begin?", "mcq", 
   JSON.stringify({"a": "Ready and excited to take part", "b": "Okay-nothing special", "c": "A bit nervous or unsure", "d": "It really depends on the activity"})],
  [12, "C", "I feel safe to make mistakes and try new things in my classroom.", "mcq", 
   JSON.stringify({"a": "Strongly Agree", "b": "Agree", "c": "Neutral", "d": "Disagree", "e": "Strongly Disagree"})],
  [13, "C", "How happy are you in your classroom overall right now?", "mcq", 
   JSON.stringify({"a": "Very happy", "b": "Happy", "c": "Okay", "d": "Unhappy", "e": "Not happy"})],
  [14, "C", "What does your classroom do well that makes you feel supported as a learner and leader?", "open", null],
  [15, "C", "Is there anything about your classroom that makes you feel less confident? What would help?", "open", null],
  
  // Section D
  [16, "D", "Have you ever held a classroom leadership role?", "mcq", 
   JSON.stringify({"a": "Yes, I currently have one", "b": "Yes, I have had one before", "c": "No, but I would like one", "d": "No, and I'm not sure it interests me"})],
  [17, "D", "Which classroom leadership qualities do you already show? (Choose all that apply)", "checkbox", 
   JSON.stringify({
       "a": "I help classmates who don’t understand", 
       "b": "I suggest ideas in group work", 
       "c": "I make sure everyone has a turn", 
       "d": "I remind my group what we are supposed to do", 
       "e": "I help tidy up or set up without being asked", 
       "f": "I keep trying even when work is very hard", 
       "g": "I stay calm when things go wrong"
   })],
  [18, "D", "My classroom gives every student a fair chance to be a leader, not just the same few people.", "mcq", 
   JSON.stringify({"a": "Strongly Agree", "b": "Agree", "c": "Neutral", "d": "Disagree", "e": "Strongly Disagree"})],
  [19, "D", "Describe a time you led your group through a challenge in class. What did you do and what did you learn?", "open", null],
  [20, "D", "If you were given a leadership role in your class, what would you do to make your classroom better?", "open", null],
  
  // Section E
  [21, "E", "When you imagine yourself in a future class, how do you see yourself?", "mcq", 
   JSON.stringify({"a": "As a confident leader, others look up to", "b": "As someone more willing to speak up", "c": "Pretty much the same as I am now", "d": "I'm not sure-I'm still figuring it out"})],
  [22, "E", "I believe I can grow into a stronger classroom leader over the year.", "mcq", 
   JSON.stringify({"a": "Strongly Agree", "b": "Agree", "c": "Neutral", "d": "Disagree", "e": "Strongly Disagree"})],
  [23, "E", "Do you feel that classroom activities are preparing you to be a better leader in the future?", "mcq", 
   JSON.stringify({"a": "Yes, often", "b": "Sometimes", "c": "Not really"})],
  [24, "E", "What kind of classroom leader do you hope to be by the end of the year? What will you do differently?", "open", null],
  [25, "E", "Is there anything you would like your teacher to know about how you feel in class, or what would help you thrive?", "open", null]
];

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY,
        section VARCHAR NOT NULL,
        question_text TEXT NOT NULL,
        question_type VARCHAR NOT NULL,
        options TEXT
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id VARCHAR PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed INTEGER DEFAULT 0,
        student_name VARCHAR,
        student_grade INTEGER,
        student_section VARCHAR
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS responses (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR REFERENCES sessions(session_id) ON DELETE CASCADE,
        question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
        answer_text TEXT
      )
    `);
    
    const countRes = await client.query('SELECT COUNT(*) FROM questions');
    if (parseInt(countRes.rows[0].count) === 0) {
      for (const q of DEFAULT_QUESTIONS) {
        await client.query(
          'INSERT INTO questions (id, section, question_text, question_type, options) VALUES ($1, $2, $3, $4, $5)',
          [q[0], q[1], q[2], q[3], q[4]]
        );
      }
    }
  } finally {
    client.release();
  }
}

async function createSession(sessionId, studentName, studentGrade, studentSection) {
  const client = await pool.connect();
  try {
    await client.query(
      \`INSERT INTO sessions (session_id, student_name, student_grade, student_section) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (session_id) DO UPDATE SET 
       student_name = EXCLUDED.student_name, 
       student_grade = EXCLUDED.student_grade, 
       student_section = EXCLUDED.student_section\`,
      [sessionId, studentName, studentGrade, studentSection]
    );
  } finally {
    client.release();
  }
}

async function saveResponse(sessionId, questionId, answerText) {
  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT id FROM responses WHERE session_id = $1 AND question_id = $2', [sessionId, questionId]);
    if (existing.rows.length > 0) {
      await client.query('UPDATE responses SET answer_text = $1 WHERE session_id = $2 AND question_id = $3', [answerText, sessionId, questionId]);
    } else {
      await client.query('INSERT INTO responses (session_id, question_id, answer_text) VALUES ($1, $2, $3)', [sessionId, questionId, answerText]);
    }
  } finally {
    client.release();
  }
}

async function completeSession(sessionId) {
  const client = await pool.connect();
  try {
    await client.query('UPDATE sessions SET completed = 1 WHERE session_id = $1', [sessionId]);
  } finally {
    client.release();
  }
}

async function getQuestionsFromDb() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT * FROM questions ORDER BY id');
    const result = {};
    for (const q of res.rows) {
      result[q.id] = {
        id: q.id,
        section: q.section,
        text: q.question_text,
        type: q.question_type,
        options: q.options ? JSON.parse(q.options) : null
      };
    }
    return result;
  } finally {
    client.release();
  }
}

async function getDetailedSubmissions(grade, section) {
  const client = await pool.connect();
  try {
    let query = 'SELECT * FROM sessions WHERE completed = 1';
    const params = [];
    let pCount = 1;
    if (grade) {
      query += \` AND student_grade = $\${pCount++}\`;
      params.push(grade);
    }
    if (section && section.trim()) {
      query += \` AND UPPER(student_section) = UPPER($\${pCount++})\`;
      params.push(section.trim());
    }
    query += ' ORDER BY created_at DESC';
    
    const sessionsRes = await client.query(query, params);
    const submissions = [];
    
    for (const s of sessionsRes.rows) {
      const respRes = await client.query('SELECT question_id, answer_text FROM responses WHERE session_id = $1', [s.session_id]);
      const answers = {};
      for (const r of respRes.rows) {
        answers[r.question_id] = r.answer_text;
      }
      submissions.push({
        session_id: s.session_id,
        created_at: s.created_at,
        student_name: s.student_name,
        student_grade: s.student_grade,
        student_section: s.student_section,
        answers
      });
    }
    return submissions;
  } finally {
    client.release();
  }
}

async function getCompletedSessionsCount(grade, section) {
  const client = await pool.connect();
  try {
    let query = 'SELECT COUNT(*) FROM sessions WHERE completed = 1';
    const params = [];
    let pCount = 1;
    if (grade) {
      query += \` AND student_grade = $\${pCount++}\`;
      params.push(grade);
    }
    if (section && section.trim()) {
      query += \` AND UPPER(student_section) = UPPER($\${pCount++})\`;
      params.push(section.trim());
    }
    const res = await client.query(query, params);
    return parseInt(res.rows[0].count);
  } finally {
    client.release();
  }
}

async function getAllCompletedResponses(grade, section) {
  const client = await pool.connect();
  try {
    let query = \`
      SELECT r.question_id, r.answer_text, r.session_id
      FROM responses r
      JOIN sessions s ON r.session_id = s.session_id
      WHERE s.completed = 1
    \`;
    const params = [];
    let pCount = 1;
    if (grade) {
      query += \` AND s.student_grade = $\${pCount++}\`;
      params.push(grade);
    }
    if (section && section.trim()) {
      query += \` AND UPPER(s.student_section) = UPPER($\${pCount++})\`;
      params.push(section.trim());
    }
    const res = await client.query(query, params);
    return res.rows;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initDb,
  createSession,
  saveResponse,
  completeSession,
  getQuestionsFromDb,
  getDetailedSubmissions,
  getCompletedSessionsCount,
  getAllCompletedResponses
};
