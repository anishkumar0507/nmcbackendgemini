import { extractDocumentText } from './documentTextExtractor.js';
// Bulletproof Gemini response sanitizer
function sanitizeGeminiResponse(raw) {
  if (!raw) return '';
  if (typeof raw !== 'string') return raw;
  return raw
    .replace(/```json|```/g, '')
    .replace(/json/g, '')
    .trim();
}
import { scrapeBlogContent } from './scrapeBlogContent.js';
import { transcribe } from './transcriptionService.js';
import { performAudit, performMultimodalAudit } from './auditService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { YoutubeTranscript } from 'youtube-transcript';
import { analyzeWithGemini } from '../geminiService.js';
import AuditRecord from '../models/AuditRecord.js';
import { extractTextFromImage } from './ocrService.js';

const MAX_TEXT_LENGTH = 100000;
const MAX_MEDIA_SIZE = 100 * 1024 * 1024;
const REQUEST_TIMEOUT = 60000;
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
];

const getRandomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

const delay = (minMs = 300, maxMs = 900) => {
  const jitter = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, jitter));
};

const validateInputSize = (input, type) => {
  if (type === 'text' && typeof input === 'string' && input.length > MAX_TEXT_LENGTH) {
    throw new Error(`Text content exceeds ${MAX_TEXT_LENGTH} characters limit`);
  }
};

export const detectContentType = (input) => {
  if (input.text) {
    console.log('[Content Detection] Type detected: text');
    return 'text';
  }
  if (input.url) {
    console.log('[Content Detection] Type detected: url');
    return 'url';
  }
  if (input.file) {
    const mimetype = input.file?.mimetype || '';
    if (mimetype) {
      if (mimetype.startsWith('image/')) {
        console.log('[Content Detection] Type detected: image');
        return 'image';
      }
      if (mimetype.startsWith('video/')) {
        console.log('[Content Detection] Type detected: video');
        return 'video';
      }
      if (mimetype.startsWith('audio/')) {
        console.log('[Content Detection] Type detected: audio');
        return 'audio';
      }
      // Normalize all document types
      if ([
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ].includes(mimetype)) {
        console.log('[Content Detection] Type detected: document');
        return 'document';
      }
    }
    // Fallback to file extension
    const ext = input.file?.originalname?.split('.').pop()?.toLowerCase() || '';
    if (ext) {
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        console.log('[Content Detection] Fallback used: image');
        return 'image';
      }
      if (['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'm4v'].includes(ext)) {
        console.log('[Content Detection] Fallback used: video');
        return 'video';
      }
      if (['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'wma'].includes(ext)) {
        console.log('[Content Detection] Fallback used: audio');
        return 'audio';
      }
      if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) {
        console.log('[Content Detection] Fallback used: document');
        return 'document';
      }
    }
    console.log('[Content Detection] Fallback used: unknown');
    return 'unknown';
  }
  console.log('[Content Detection] Fallback used: unknown');
  return 'unknown';
};

const isYouTubeUrl = (url) => {
  const urlLower = url.toLowerCase();
  return urlLower.includes('youtube.com') || urlLower.includes('youtu.be');
};

const detectUrlContentType = (url) => {
  const urlLower = url.toLowerCase();
  const videoPlatforms = [
    'youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com',
    'facebook.com/watch', 'instagram.com/reel', 'tiktok.com',
    'twitch.tv'
  ];
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.m4v'];
  const audioExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.wma'];

  if (videoPlatforms.some(platform => urlLower.includes(platform))) return 'video';
  if (videoExtensions.some(ext => urlLower.includes(ext))) return 'video';
  if (audioExtensions.some(ext => urlLower.includes(ext))) return 'audio';

  return 'webpage';
};

const downloadMediaFile = async (url) => {
  console.log(`[URL Processor] Downloading media from: ${url}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    await delay();
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': getRandomUserAgent()
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_MEDIA_SIZE) {
      throw new Error(`File size (${(buffer.length / 1024 / 1024).toFixed(2)}MB) exceeds limit of ${MAX_MEDIA_SIZE / 1024 / 1024}MB`);
    }

    return { buffer, mimetype: contentType };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Download timeout: URL took too long to respond');
    }
    throw new Error(`Failed to download media: ${error.message}`);
  }
};

const extractYouTubeVideoId = (url) => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.replace('/', '').trim() || null;
    }
    if (parsed.searchParams.has('v')) {
      return parsed.searchParams.get('v');
    }
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const shortsIndex = pathParts.indexOf('shorts');
    if (shortsIndex !== -1 && pathParts[shortsIndex + 1]) {
      return pathParts[shortsIndex + 1];
    }
    const embedIndex = pathParts.indexOf('embed');
    if (embedIndex !== -1 && pathParts[embedIndex + 1]) {
      return pathParts[embedIndex + 1];
    }
    return null;
  } catch {
    return null;
  }
};

const fetchYouTubeTranscript = async (url) => {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    console.warn('[YouTube Transcript] Invalid URL, unable to extract video ID');
    throw new Error('Invalid YouTube URL format. Please provide a valid YouTube video link.');
  }

  try {
    await delay(400, 1200);
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
    const transcript = transcriptItems.map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim();

    if (!transcript) {
      console.warn('[YouTube Transcript] Empty transcript received');
      throw new Error('Transcript unavailable');
    }

    console.log(`[YouTube Transcript] Success | Video: ${videoId} | Length: ${transcript.length} chars`);
    return transcript;
  } catch (error) {
    console.error(`[YouTube Transcript] Failure | Video: ${videoId} | Error: ${error.message}`);
    throw new Error(`YouTube transcript unavailable: ${error.message}`);
  }
};

const fetchYouTubeFallbackText = async (url, reason) => {
  const fallbackLines = [];
  fallbackLines.push('YouTube transcript unavailable.');
  if (reason) {
    fallbackLines.push(`Reason: ${reason}`);
  }
  fallbackLines.push(`Video URL: ${url}`);

  try {
    await delay(300, 800);
    let description = '';
    try {
      const videoResponse = await fetch(url, {
        headers: {
          'User-Agent': getRandomUserAgent()
        }
      });
      if (videoResponse.ok) {
        const html = await videoResponse.text();
        const match = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
        if (match && match[1]) {
          description = match[1];
        }
      }
    } catch (error) {
      console.warn('[YouTube Transcript] Description fetch failed:', error.message);
    }

    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
      headers: {
        'User-Agent': getRandomUserAgent()
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.title) {
        fallbackLines.push(`Title: ${data.title}`);
      }
      if (data?.author_name) {
        fallbackLines.push(`Channel: ${data.author_name}`);
      }
    }

    if (description) {
      fallbackLines.push(`Description: ${description}`);
    }
  } catch (error) {
    console.warn('[YouTube Transcript] Fallback metadata unavailable:', error.message);
  }

  const fallbackText = fallbackLines.join(' ');
  return fallbackText.length < 60
    ? `${fallbackText} Please provide a summary or upload a file for review.`
    : fallbackText;
};

const validateGeminiResult = (result) => {
  const requiredKeys = [
    'score',
    'status',
    'summary',
    'transcription',
    'financialPenalty',
    'ethicalMarketing',
    'violations'
  ];
  if (!result || typeof result !== 'object') {
    console.error('[Content Processor] Invalid Gemini JSON:', result);
    return false;
  }
  const missing = requiredKeys.filter((key) => !(key in result));
  if (missing.length > 0) {
    console.error('[Content Processor] Invalid Gemini JSON:', JSON.stringify(result));
    return false;
  }
  if (!Array.isArray(result.violations)) {
    console.error('[Content Processor] Invalid Gemini JSON:', JSON.stringify(result));
    return false;
  }
  return true;
};

const saveAuditRecord = async ({
  userId,
  contentType,
  originalInput,
  extractedText,
  transcript,
  auditResult
}) => {
  // Only save if valid
  if (!validateGeminiResult(auditResult)) return null;
  const record = new AuditRecord({
    userId,
    contentType,
    originalInput,
    extractedText,
    transcript,
    auditResult
  });
  await record.save();
  return record;
};

const processText = async ({ text, category, analysisMode }) => {
  validateInputSize(text, 'text');

  const auditResult = await analyzeWithGemini({
    content: text,
    inputType: 'text',
    category,
    analysisMode
  });

  return {
    contentType: 'text',
    originalInput: text,
    extractedText: text,
    transcript: '',
    auditResult
  };
};

const processMediaBuffer = async ({ buffer, mimetype, inputType, originalInput, category, analysisMode }) => {
  const transcriptionResult = await transcribe(buffer, mimetype);
  const transcriptText = transcriptionResult.transcript;

  const auditResult = await analyzeWithGemini({
    content: transcriptText,
    inputType,
    category,
    analysisMode
  });

  return {
    contentType: inputType,
    originalInput,
    extractedText: transcriptText,
    transcript: transcriptText,
    auditResult
  };
};

const processImageBuffer = async ({ buffer, originalInput, category, analysisMode }) => {
  const extractedText = await extractTextFromImage(buffer);

  if (!extractedText || !extractedText.trim()) {
    throw new Error('Unable to extract readable text from image');
  }

  const auditResult = await analyzeWithGemini({
    content: extractedText,
    inputType: 'image',
    category,
    analysisMode
  });

  return {
    contentType: 'image',
    originalInput,
    extractedText,
    transcript: extractedText,
    auditResult
  };
};

const processUrl = async ({ url, category, analysisMode }) => {
  const urlType = detectUrlContentType(url);

  // === ISSUE 1: YouTube Transcript Disabled Handling ===
  if (isYouTubeUrl(url)) {
    let transcriptText = '';
    let usedAudioFallback = false;
    try {
      transcriptText = await fetchYouTubeTranscript(url);
    } catch (error) {
      console.log('[YouTube] Transcript disabled');
      // Do NOT use metadata fallback. Trigger audio transcription fallback.
      try {
        console.log('[YouTube] Downloading audio');
        const tempDir = '/tmp';
        const maxDurationSec = 600; // 10 minutes
        const maxSizeBytes = 25 * 1024 * 1024; // 25MB
        const { filePath, error: audioError } = await downloadYouTubeAudio(url, tempDir, maxDurationSec, maxSizeBytes);
        if (audioError) {
          return { error: audioError };
        }
        // Transcribe audio
        let transcriptResult;
        try {
          transcriptResult = await transcribe(fs.readFileSync(filePath), 'audio/mp3');
        } catch (transcribeErr) {
          fs.unlinkSync(filePath);
          return { error: 'Audio transcription failed: ' + (transcribeErr.message || transcribeErr) };
        }
        fs.unlinkSync(filePath);
        transcriptText = transcriptResult.transcript;
        usedAudioFallback = true;
        if (!transcriptText || transcriptText.length < 50) {
          return { error: 'Transcription too short or empty.' };
        }
        console.log('[YouTube] Transcription success');
      } catch (audioFallbackErr) {
        return { error: 'YouTube audio fallback failed: ' + (audioFallbackErr.message || audioFallbackErr) };
      }
    }
    if (!transcriptText || transcriptText.length < 50) {
      return { error: 'Transcript unavailable or too short.' };
    }
    let auditResult;
    try {
      auditResult = await analyzeWithGemini({
        content: transcriptText,
        inputType: 'video',
        category,
        analysisMode
      });
      console.log('[YouTube] Gemini audit success');
    } catch (geminiErr) {
      return { error: 'Gemini audit failed: ' + (geminiErr.message || geminiErr) };
    }
    return {
      contentType: 'video',
      originalInput: url,
      extractedText: transcriptText,
      transcript: transcriptText,
      auditResult
    };
  }

  // === ISSUE 2: Blog URL Bot Protection (403) ===
  // Use robust blog scraping utility
  try {
    const scraped = await scrapeBlogContent(url);
    if (scraped.error || !scraped.content || scraped.content.length < 50) {
      return { error: 'Unable to extract actual website content due to bot protection or insufficient content.' };
    }
    let auditResult;
    try {
      auditResult = await analyzeWithGemini({
        content: scraped.content,
        inputType: 'webpage',
        category,
        analysisMode
      });
    } catch (geminiErr) {
      return { error: 'Gemini audit failed: ' + (geminiErr.message || geminiErr) };
    }
    return {
      contentType: 'webpage',
      originalInput: url,
      extractedText: scraped.content,
      transcript: scraped.content,
      auditResult
    };
  } catch (error) {
    return { error: 'Content could not be extracted due to access restrictions or timeouts. URL: ' + url + '. Please provide text or upload a file for review.' };
  }
};

export const processContent = async (input, options = {}) => {
  const { userId, category, analysisMode } = options;

  if (!userId) {
    throw new Error('Authentication required');
  }

  const contentType = detectContentType(input);
  let processingResult;

  if (contentType === 'text') {
    processingResult = await processText({ text: input.text, category, analysisMode });
  } else if (contentType === 'url') {
    processingResult = await processUrl({ url: input.url, category, analysisMode });
  } else if (contentType === 'video' || contentType === 'audio') {
    processingResult = await processMediaBuffer({
      buffer: input.file.buffer,
      mimetype: input.file.mimetype,
      inputType: contentType,
      originalInput: input.file.originalname || `uploaded ${contentType}`,
      category,
      analysisMode
    });
  } else if (contentType === 'image') {
    processingResult = await processImageBuffer({
      buffer: input.file.buffer,
      originalInput: input.file.originalname || 'uploaded image',
      category,
      analysisMode
    });
  } else if (contentType === 'document') {
    // DOCX/PDF extraction and bulletproof Gemini audit
    let mimetype = input.file.mimetype;
    let extractedText = '';
    try {
      const docResult = await extractDocumentText(input.file.buffer, mimetype);
      extractedText = (docResult.text || '').trim();
    } catch (err) {
      extractedText = '';
    }
    if (!extractedText || extractedText.length < 20) {
      processingResult = {
        contentType: 'document',
        originalInput: input.file.originalname || 'uploaded document',
        extractedText,
        transcript: extractedText,
        auditResult: {
          score: 0,
          status: 'Needs Review',
          summary: 'Document extraction failed or content too short.',
          transcription: '',
          financialPenalty: { riskLevel: 'Unknown', description: 'Could not evaluate.' },
          ethicalMarketing: { score: 0, assessment: 'Could not evaluate.' },
          violations: []
        }
      };
    } else {
      let rawGeminiOutput = '';
      let auditResult = null;
      try {
        rawGeminiOutput = await analyzeWithGemini({
          content: extractedText,
          inputType: 'document',
          category,
          analysisMode
        });
        const cleaned = sanitizeGeminiResponse(rawGeminiOutput);
        if (typeof cleaned === 'object') {
          auditResult = cleaned;
        } else {
          try {
            auditResult = JSON.parse(cleaned);
          } catch (err) {
            console.error('Gemini JSON Parse Error:');
            console.error('Raw Output:', rawGeminiOutput);
            auditResult = {
              score: 0,
              status: 'Needs Review',
              summary: 'AI response parsing failed.',
              transcription: '',
              financialPenalty: { riskLevel: 'Unknown', description: 'Could not evaluate.' },
              ethicalMarketing: { score: 0, assessment: 'Could not evaluate.' },
              violations: []
            };
          }
        }
      } catch (err) {
        auditResult = {
          score: 0,
          status: 'Needs Review',
          summary: 'Gemini audit failed.',
          transcription: '',
          financialPenalty: { riskLevel: 'Unknown', description: 'Could not evaluate.' },
          ethicalMarketing: { score: 0, assessment: 'Could not evaluate.' },
          violations: []
        };
      }
      processingResult = {
        contentType: 'document',
        originalInput: input.file.originalname || 'uploaded document',
        extractedText,
        transcript: extractedText,
        auditResult
      };
    }
  }
  else if (contentType === 'unknown') {
    console.error('[Content Detection] Unable to detect content type');
    processingResult = {
      contentType: 'unknown',
      originalInput: input.file?.originalname || 'unknown input',
      extractedText: null,
      transcript: null,
      auditResult: { error: 'Unable to detect content type. Please upload a supported file.' }
    };
  } else {
    processingResult = {
      contentType: 'unsupported',
      originalInput: input.file?.originalname || 'unsupported input',
      extractedText: null,
      transcript: null,
      auditResult: { error: 'Unsupported input type.' }
    };
  }

  await saveAuditRecord({
    userId,
    contentType: processingResult.contentType,
    originalInput: processingResult.originalInput,
    extractedText: processingResult.extractedText,
    transcript: processingResult.transcript,
    auditResult: processingResult.auditResult
  });

  // Always return a valid audit object
  if (processingResult && processingResult.auditResult) {
    return processingResult.auditResult;
  }
  // Fallback: never return null/undefined
  return {
    score: 0,
    status: 'Needs Review',
    summary: 'Audit failed.',
    transcription: '',
    financialPenalty: { riskLevel: 'Unknown', description: 'Could not evaluate.' },
    ethicalMarketing: { score: 0, assessment: 'Could not evaluate.' },
    violations: []
  };
};

export default { processContent };
