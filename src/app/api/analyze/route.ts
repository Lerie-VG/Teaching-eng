import { NextResponse } from 'next/server';
import { AnalysisRequest, AnalysisResult, Criterion } from '@/types';
import { franc } from 'franc-min';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Simple in-memory rate limiting per IP
const rateLimitMap = new Map<string, { count: number; lastRequest: number }>();
const RATE_LIMIT = 5; // max requests per window
const WINDOW_MS = 60 * 1000; // 1 minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, lastRequest: now };
  if (now - entry.lastRequest > WINDOW_MS) {
    // Reset window
    rateLimitMap.set(ip, { count: 1, lastRequest: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT) {
    return true;
  }
  entry.count += 1;
  entry.lastRequest = now;
  rateLimitMap.set(ip, entry);
  return false;
}

// Helper: Check if most sentences are English
function isMostlyEnglish(text: string, threshold = 0.2): boolean {
  // Split by sentence-ending punctuation or newlines
  const sentences = text.split(/[.!?\\n]+/).map(s => s.trim()).filter(Boolean);
  if (sentences.length === 0) return false;
  let nonEnglish = 0;
  for (const sentence of sentences) {
    if (franc(sentence) !== 'eng') nonEnglish++;
  }
  const percentNonEnglish = nonEnglish / sentences.length;
  return percentNonEnglish <= threshold;
}

function parseAnalysisOutput(output: string, writing: string): AnalysisResult {
  console.log('Parsing output:', output); // Debug log
  
  const criteria: Criterion[] = [];
  let overallScore = 0;
  let errors: any[] = [];
  
  // Split output to separate analysis from errors
  const errorsSectionIndex = output.indexOf('ERRORS:');
  const analysisText = errorsSectionIndex !== -1 ? output.substring(0, errorsSectionIndex) : output;
  const errorsText = errorsSectionIndex !== -1 ? output.substring(errorsSectionIndex) : '';
  
  // Parse errors if present
  if (errorsText) {
    try {
      // Find all JSON arrays in the errors section
      const errorMatches = errorsText.match(/\[[\s\S]*?\]/g);
      if (errorMatches) {
        errors = errorMatches.map((jsonStr) => {
          try {
            return JSON.parse(jsonStr);
          } catch {
            return null;
          }
        }).filter(Boolean).flat();
        // Map 'register' errors to 'style'
        errors = errors.map(e => e && e.type === 'register' ? { ...e, type: 'style' } : e);
        // Attach start/end positions for each error occurrence in the writing
        const usedRanges: boolean[] = Array(writing.length).fill(false);
        errors = errors.map((e) => {
          if (!e || !e.text) return e;
          const normWriting = writing.toLowerCase();
          const normError = e.text.toLowerCase();
          let start = -1;
          // Find the first non-overlapping match
          for (let i = 0; i <= normWriting.length - normError.length; i++) {
            if (
              normWriting.substring(i, i + normError.length) === normError &&
              !usedRanges.slice(i, i + normError.length).some(Boolean)
            ) {
              start = i;
              // Mark this range as used
              for (let j = i; j < i + normError.length; j++) usedRanges[j] = true;
              break;
            }
          }
          if (start !== -1) {
            return { ...e, start, end: start + e.text.length };
          }
          return e;
        });
        console.log('Parsed errors:', errors);
      }
    } catch (e) {
      console.log('Error parsing failed:', e);
    }
  }
  
  // Primary regex - more flexible with formatting, now allows decimal scores
  const regex = /(Content|Communicative Achievement|Organisation|Language)\s*\((\d(?:\.\d)?)\/5\):\s*([\s\S]*?)(?=(?:Content|Communicative Achievement|Organisation|Language)\s*\(\d(?:\.\d)?\/5\):|$)/gi;
  let match;
  
  while ((match = regex.exec(analysisText)) !== null) {
    const name = match[1].trim();
    const score = parseFloat(match[2]);
    const feedback = match[3].trim().replace(/\n+/g, ' ');
    criteria.push({ name, score, feedback });
    overallScore += score;
  }
  
  // If we didn't get all 4 criteria, try alternative parsing
  if (criteria.length < 4) {
    console.log('Primary parsing incomplete, trying alternatives...');
    
    // Try line-by-line parsing
    const lines = analysisText.split('\n');
    const foundCriteria = new Set(criteria.map(c => c.name));
    
    for (const line of lines) {
      // Look for any missing criteria
      const altMatch = line.match(/(Content|Communicative Achievement|Organisation|Language).*?(\d)\/5.*?:\s*(.+)/i);
      if (altMatch && !foundCriteria.has(altMatch[1])) {
        const name = altMatch[1].trim();
        const score = parseFloat(altMatch[2]);
        const feedback = altMatch[3].trim();
        criteria.push({ name, score, feedback });
        overallScore += score;
        foundCriteria.add(name);
      }
    }
  }
  
  // Ensure we have all 4 criteria - add missing ones
  const requiredCriteria = ['Content', 'Communicative Achievement', 'Organisation', 'Language'];
  const foundNames = criteria.map(c => c.name);
  
  for (const required of requiredCriteria) {
    if (!foundNames.includes(required)) {
      console.log(`Missing criterion: ${required}, adding default`);
      
      // Try to find any mention of this criterion in the text
      const pattern = new RegExp(`${required.toLowerCase()}[^]*?(\d)\/5`, 'i');
      const match = analysisText.match(pattern);
      const score = match ? parseFloat(match[1]) : 3;
      
      criteria.push({
        name: required,
        score,
        feedback: `Assessment provided. Please refer to the full analysis above for detailed feedback on ${required.toLowerCase()}.`
      });
      overallScore += score;
    }
  }
  
  // Sort criteria in the expected order
  const sortOrder = { 'Content': 0, 'Communicative Achievement': 1, 'Organisation': 2, 'Language': 3 };
  criteria.sort((a, b) => (sortOrder[a.name as keyof typeof sortOrder] || 999) - (sortOrder[b.name as keyof typeof sortOrder] || 999));
  
  console.log('Final criteria count:', criteria.length);
  console.log('Criteria names:', criteria.map(c => c.name));
  
  return {
    overallScore: criteria.length > 0 ? Math.round(overallScore / criteria.length) : 3,
    criteria,
    errors: errors // Add errors to the result
  };
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

function isMeaningful(text: string): boolean {
  // Remove punctuation for word analysis
  const words = text.replace(/[^\w\s]/g, '').toLowerCase().split(/\s+/).filter(Boolean);
  const uniqueWords = new Set(words);
  const vocabRatio = uniqueWords.size / words.length;

  // Check for excessive repetition
  const wordCounts: Record<string, number> = {};
  let mostCommonCount = 0;
  for (const word of words) {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
    if (wordCounts[word] > mostCommonCount) mostCommonCount = wordCounts[word];
  }
  const repetitionRatio = mostCommonCount / words.length;

  // Check for alphabetic content
  const alphaChars = text.replace(/[^a-zA-Z]/g, '').length;
  const alphaRatio = alphaChars / text.length;

  // Check for HTML/code
  const hasHtmlOrCode = /<[^>]+>|{[^}]+}|console\.log|function\s*\(/.test(text);

  // Heuristics
  if (vocabRatio < 0.3) return false;
  if (repetitionRatio > 0.5) return false;
  if (alphaRatio < 0.5) return false;
  if (hasHtmlOrCode) return false;

  return true;
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests', message: 'You are being rate limited. Please try again later.' },
        { status: 429 }
      );
    }

    // Debug: Check if Groq token is present
    console.log('GROQ_API_KEY present:', !!process.env.GROQ_API_KEY);

    const body: AnalysisRequest = await request.json();
    const { examLevel, taskType, writing } = body;

    // Simple meaningful content check
    if (!isMeaningful(writing)) {
      return NextResponse.json(
        { error: 'Unmeaningful content', message: 'Please submit a meaningful English text for analysis.' },
        { status: 400 }
      );
    }

    // Chunk-based language detection
    if (!isMostlyEnglish(writing)) {
      return NextResponse.json(
        {
          error: 'Non-English text detected',
          message: 'Your submission contains too much non-English content. Please submit your writing in English.',
        },
        { status: 400 }
      );
    }

    // Validate word count
    const wordCount = countWords(writing);
    const charCount = writing.length;
    console.log('Word count:', wordCount);
    console.log('Character count:', charCount);
    
    if (wordCount < 150) {
      return NextResponse.json(
        { 
          error: 'Insufficient word count', 
          message: `Your writing contains only ${wordCount} words. Please provide at least 150 words for a meaningful assessment.`,
          wordCount 
        },
        { status: 400 }
      );
    }

    if (wordCount > 500) {
      return NextResponse.json(
        { 
          error: 'Excessive word count', 
          message: `Your writing contains ${wordCount} words. The maximum allowed is 500 words.`,
          wordCount 
        },
        { status: 400 }
      );
    }

    if (charCount > 4000) {
      return NextResponse.json(
        { 
          error: 'Excessive character count', 
          message: `Your writing contains ${charCount} characters. The maximum allowed is 4000 characters.`,
          charCount 
        },
        { status: 400 }
      );
    }

    // Enhanced prompt for better consistency + error detection
    const prompt = `You are an official Cambridge ${examLevel} examiner. Analyze this ${taskType} using official Cambridge assessment criteria.

TASK: Provide scores (1-5) and detailed feedback for each criterion below. Use EXACTLY this format, starting each criterion on a new line:

Content (X/5): [detailed feedback about task fulfillment]
Communicative Achievement (X/5): [detailed feedback about register and conventions]
Organisation (X/5): [detailed feedback about structure and cohesion]
Language (X/5): [detailed feedback about vocabulary and grammar]

Do not include feedback for one criterion inside another. Each criterion must be on its own line, and feedback for each must be separate.

ASSESSMENT CRITERIA:
1. CONTENT (1-5): Check if all task points are addressed with appropriate development
2. COMMUNICATIVE ACHIEVEMENT (1-5): Evaluate register, tone, and task-specific conventions
3. ORGANISATION (1-5): Assess logical structure, paragraphing, and linking devices
4. LANGUAGE (1-5): Check vocabulary range, accuracy, and grammatical control for ${examLevel} level

After your assessment, identify specific language errors in the text. Only flag style/register errors if the phrase is clearly informal, uses slang, contractions, or is inappropriate for academic or semi-formal writing. Do NOT flag phrases as errors if they are acceptable in formal or semi-formal academic English. For each error, in the "text" field, include only the exact word or phrase that is incorrect, not the whole sentence. List them in this EXACT format:

ERRORS:
[{"text": "exact error text", "correction": "corrected version", "type": "grammar", "explanation": "brief explanation"}]

Student writing to analyze:
"${writing}"

Provide your analysis followed by the errors list:`;

    // Call Groq API
    const groqResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-70b-8192', // Corrected model name for Groq
        messages: [
          {
            role: 'system',
            content: `You are a Cambridge English examiner specializing in ${examLevel} assessments. Always respond in the exact format requested.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
        top_p: 0.9,
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error('Groq API Error:', groqResponse.status, errorText);
      throw new Error(`Groq API Error: ${groqResponse.status} - ${errorText}`);
    }

    const groqResult = await groqResponse.json();
    
    // Extract the assistant's response
    const output = groqResult.choices?.[0]?.message?.content || 'No response generated';
    // Debug: Log the raw output for troubleshooting
    console.log('Raw AI output:', output);
    const analysis = parseAnalysisOutput(output, writing);
    // Debug: Log the parsed errors array
    console.log('Errors array sent to frontend:', analysis.errors);
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze writing', details: String(error) },
      { status: 500 }
    );
  }
}