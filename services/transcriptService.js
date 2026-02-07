import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Transcription Service
 * Uses OpenAI Whisper API for audio/video transcription
 * 
 * IMPORTANT SEPARATION:
 * - OpenAI: Used ONLY for transcription (this service)
 * - Gemini: Used ONLY for compliance analysis (aiAuditService)
 * - Transcription text is passed to Gemini for analysis
 * - NEVER mix API keys: OPENAI_API_KEY vs GOOGLE_VERTEX_PROJECT
 */

const MAX_AUDIO_DURATION = 600; // 10 minutes in seconds
const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB (OpenAI limit)

// OpenAI client instance (singleton pattern)
let openaiClient = null;

/**
 * Get or create OpenAI client instance
 * Uses OPENAI_API_KEY from environment
 * @returns {OpenAI} OpenAI client
 */
const getOpenAIClient = () => {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }
    
    openaiClient = new OpenAI({
      apiKey: apiKey
    });
    
    console.log('[Transcription] OpenAI client initialized');
  }
  
  return openaiClient;
};

/**
 * Validate audio/video file
 * @param {Buffer} buffer - File buffer
 * @param {string} mimetype - MIME type
 * @returns {void}
 */
const validateMediaFile = (buffer, mimetype) => {
  if (buffer.length > MAX_AUDIO_SIZE) {
    throw new Error(`File size exceeds ${MAX_AUDIO_SIZE / 1024 / 1024}MB limit`);
  }
  
  const allowedTypes = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/webm',
    'audio/ogg',
    'audio/m4a',
    'audio/flac',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/mpeg'
  ];
  
  if (!allowedTypes.some(type => mimetype.includes(type.split('/')[1]))) {
    throw new Error(`Unsupported media type: ${mimetype}`);
  }
};

/**
 * Convert MIME type to OpenAI-compatible format
 * @param {string} mimetype - Original MIME type
 * @returns {string} OpenAI format
 */
const convertMimeType = (mimetype) => {
  const mimeMap = {
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/m4a': 'm4a',
    'audio/flac': 'flac',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'video/mpeg': 'mpeg'
  };
  
  for (const [mime, format] of Object.entries(mimeMap)) {
    if (mimetype.includes(mime.split('/')[1])) {
      return format;
    }
  }
  
  return 'mp3'; // Default fallback
};

/**
 * Transcribe audio using OpenAI Whisper API
 * @param {Buffer} audioBuffer - Audio file buffer
 * @param {string} mimetype - MIME type
 * @returns {Promise<string>} Transcript
 */
export const transcribeAudio = async (audioBuffer, mimetype) => {
  try {
    validateMediaFile(audioBuffer, mimetype);
    
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set. OpenAI is required for transcription.');
    }
    
    console.log('[Transcription] Starting audio transcription with OpenAI Whisper...');
    
    const openai = getOpenAIClient();
    
    // Create a temporary file for OpenAI API
    // OpenAI Whisper API requires a file, not a buffer directly
    const tempFilePath = path.join(__dirname, `temp_audio_${Date.now()}.${convertMimeType(mimetype)}`);
    
    try {
      // Write buffer to temporary file
      fs.writeFileSync(tempFilePath, audioBuffer);
      
      // For Node.js, create a File object from the buffer
      // Node.js 18+ has native File API support
      // If File is not available, we'll use the file path approach
      let file;
      if (typeof File !== 'undefined') {
        // Use native File API (Node.js 18+)
        file = new File([audioBuffer], `audio.${convertMimeType(mimetype)}`, { type: mimetype });
      } else {
        // Fallback: Use file path with createReadStream
        file = fs.createReadStream(tempFilePath);
      }
      
      // Call OpenAI Whisper API
      // Note: Using OpenAI ONLY for transcription - never for compliance analysis
      const transcription = await openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: 'en', // Can be made configurable
        response_format: 'text',
        prompt: 'This is a healthcare advertisement. Transcribe all spoken words, claims, and marketing messages accurately.'
      });
      
      let transcript = '';
      if (typeof transcription === 'string') {
        transcript = transcription;
      } else if (transcription.text) {
        transcript = transcription.text;
      } else {
        throw new Error('Unexpected transcription response format');
      }
      
      if (!transcript.trim()) {
        throw new Error('Transcription returned empty result');
      }
      
      console.log(`[Transcription] Generated transcript (${transcript.length} chars) using OpenAI Whisper`);
      
      return transcript.trim();
    } finally {
      // Clean up temporary file
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (cleanupError) {
        console.warn('[Transcription] Failed to cleanup temp file:', cleanupError.message);
      }
    }
  } catch (error) {
    console.error('[Transcription] OpenAI Error:', error);
    
    // Provide helpful error messages
    if (error.message?.includes('API key')) {
      throw new Error('OpenAI API key is invalid or missing. Check OPENAI_API_KEY environment variable.');
    }
    
    if (error.message?.includes('file size')) {
      throw new Error(`File size exceeds OpenAI's limit of ${MAX_AUDIO_SIZE / 1024 / 1024}MB`);
    }
    
    throw new Error(`OpenAI transcription failed: ${error.message}`);
  }
};

/**
 * Extract audio from video and transcribe using OpenAI
 * @param {Buffer} videoBuffer - Video file buffer
 * @param {string} mimetype - MIME type
 * @returns {Promise<string>} Transcript
 */
export const transcribeVideo = async (videoBuffer, mimetype) => {
  // OpenAI Whisper can handle video files directly
  // It will extract audio automatically
  console.log('[Transcription] Processing video for transcription with OpenAI Whisper...');
  return transcribeAudio(videoBuffer, mimetype);
};

/**
 * Check if transcript is cached (placeholder for future implementation)
 * @param {string} contentHash - Hash of the content
 * @returns {Promise<string|null>} Cached transcript or null
 */
export const getCachedTranscript = async (contentHash) => {
  // TODO: Implement caching mechanism
  return null;
};

/**
 * Cache transcript (placeholder for future implementation)
 * @param {string} contentHash - Hash of the content
 * @param {string} transcript - Transcript to cache
 */
export const cacheTranscript = async (contentHash, transcript) => {
  // TODO: Implement caching mechanism
};

export default {
  transcribeAudio,
  transcribeVideo,
  getCachedTranscript,
  cacheTranscript
};
