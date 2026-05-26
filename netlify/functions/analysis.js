const natural = require('natural');
const { removeStopwords } = require('stopword');

const EVALUATIVE_BLACKLIST = new Set([
  'good', 'excellent', 'great', 'amazing', 'awesome', 'bad', 'terrible', 'wonderful', 
  'nice', 'super', 'fantastic', 'perfect', 'horrible', 'best', 'worst', 'cool',
  'love', 'hate', 'like', 'dislike', 'fine', 'lovely', 'pretty', 'happy', 'sad'
]);

const CONFIDENT_CUES = new Set([
  'lead', 'leader', 'leadership', 'charge', 'share', 'excited', 
  'helped', 'help', 'made sure', 'initiative', 'confident', 'confidence',
  'easy', 'glad', 'proud', 'creative', 'solver', 'solving', 'stronger', 
  'thrive', 'initiative', 'contribute', 'praise', 'guid', 'guide', 'teach'
]);

const NEEDS_SUPPORT_CUES = new Set([
  'nervous', 'unsure', 'unhappy', 'difficult', 'hard', 'less confident', 
  'scared', 'struggle', 'struggling', 'confused', 'afraid', 'mistake', 
  'wrong', 'fear', 'worried', 'lonely', 'worry', 'intimidated', 'quiet', 
  'hide', 'ignore', 'impossible', 'stress', 'stressed', 'pressur',
  'anxious', 'not sure', 'growing', 'rarely', 'never', 'support'
]);

function analyzeQuantitative(responses, questionDefs) {
  const distributions = {};
  for (const qId in questionDefs) {
    const qDef = questionDefs[qId];
    if (qDef.type === "mcq" || qDef.type === "checkbox") {
      distributions[qId] = {};
      if (qDef.options) {
        for (const opt in qDef.options) {
          distributions[qId][opt] = 0;
        }
      }
    }
  }

  for (const resp of responses) {
    const qId = resp.question_id;
    const answer = resp.answer_text;
    if (!distributions[qId] || !answer) continue;

    const qType = questionDefs[qId].type;
    if (qType === "mcq") {
      const ansClean = String(answer).trim().toLowerCase();
      if (distributions[qId][ansClean] !== undefined) {
        distributions[qId][ansClean]++;
      }
    } else if (qType === "checkbox") {
      const parts = String(answer).split(",").map(p => p.trim().toLowerCase()).filter(p => p);
      for (const part of parts) {
        if (distributions[qId][part] !== undefined) {
          distributions[qId][part]++;
        }
      }
    }
  }
  return distributions;
}

const Analyzer = natural.SentimentAnalyzer;
const stemmer = natural.PorterStemmer;
const analyzer = new Analyzer("English", stemmer, "afinn");

function analyzeSentimentRaw(text) {
  const textLower = text.toLowerCase();
  
  const hasNeedsSupport = Array.from(NEEDS_SUPPORT_CUES).some(cue => textLower.includes(cue));
  const hasConfident = Array.from(CONFIDENT_CUES).some(cue => textLower.includes(cue));
  
  if (hasNeedsSupport) return "Needs Support";

  try {
    const tokenizer = new natural.WordTokenizer();
    const tokens = tokenizer.tokenize(text);
    const score = analyzer.getSentiment(tokens);
    if (score < -1) return "Needs Support";
    if (score > 1.5) return "Confident";
  } catch (e) {}
  
  if (hasConfident) return "Confident";
  return "Neutral";
}

function extractPosKeywordsForTexts(texts, topN = 10) {
  const allVerbs = [];
  const allNouns = [];
  const tokenizer = new natural.WordTokenizer();

  for (const text of texts) {
    const textClean = String(text).trim();
    if (!textClean) continue;
    
    const tokens = tokenizer.tokenize(textClean.toLowerCase());
    const filteredTokens = removeStopwords(tokens);
    
    for (const w of filteredTokens) {
      if (EVALUATIVE_BLACKLIST.has(w) || w.length < 3) continue;
      
      // Simple heuristic for POS tagging replacement in JS
      if (w.endsWith('ing') || w.endsWith('ed') || ['do', 'make', 'help', 'take', 'lead', 'share', 'say', 'feel', 'want', 'hear', 'see'].includes(w)) {
        allVerbs.push(w);
      } else {
        allNouns.push(w);
      }
    }
  }
  
  const verbCounts = countFrequencies(allVerbs, topN);
  const nounCounts = countFrequencies(allNouns, topN);
  
  return { verbs: verbCounts, nouns: nounCounts };
}

function countFrequencies(arr, topN) {
  const counts = {};
  for (const item of arr) {
    counts[item] = (counts[item] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({ word, count }));
}

function analyzeQualitative(responses, questionDefs) {
  const sentimentBuckets = { "Confident": [], "Neutral": [], "Needs Support": [] };
  const allOpenTexts = [];
  const problemTexts = [];
  const leadershipTexts = [];
  const aspirationTexts = [];
  
  const problemResponses = [];
  const leadershipResponses = [];
  const aspirationResponses = [];

  for (const resp of responses) {
    const qId = resp.question_id;
    const answer = resp.answer_text;
    const qDef = questionDefs[qId] || {};
    
    if (qDef.type !== "open" || !answer) continue;
    
    const text = String(answer).trim();
    if (!text) continue;
    
    allOpenTexts.push(text);
    const sentiment = analyzeSentimentRaw(text);
    
    const respItem = {
      session_id: resp.session_id,
      question_id: qId,
      question_text: qDef.text,
      response: text,
      sentiment: sentiment
    };
    
    sentimentBuckets[sentiment].push(respItem);
    
    if (qId === 15) {
      problemTexts.push(text);
      problemResponses.push(respItem);
    } else if (qId === 16 || qId === 17 || qId === 20) {
      leadershipTexts.push(text);
      leadershipResponses.push(respItem);
    } else if (qId === 10 || qId === 25) {
      aspirationTexts.push(text);
      aspirationResponses.push(respItem);
    }
  }
  
  return {
    sentiment_buckets: sentimentBuckets,
    keywords: extractPosKeywordsForTexts(allOpenTexts),
    problems: { keywords: extractPosKeywordsForTexts(problemTexts), responses: problemResponses },
    leadership: { keywords: extractPosKeywordsForTexts(leadershipTexts), responses: leadershipResponses },
    aspirations: { keywords: extractPosKeywordsForTexts(aspirationTexts), responses: aspirationResponses }
  };
}

module.exports = {
  analyzeQuantitative,
  analyzeQualitative
};
