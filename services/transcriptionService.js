import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Transcription Service
 * Uses OpenAI gpt-4o-transcribe model for audio/video transcription
 * 
 * IMPORTANT: OpenAI is used ONLY for transcription
 * NEVER uses Gemini - Gemini is reserved for compliance analysis
 */

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB (OpenAI limit)
const MODEL = 'gpt-4o-transcribe'; // OpenAI transcription model

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
      throw new Error('OPENAI_API_KEY is not set. Required for transcription.');
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
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg',
    'audio/m4a', 'audio/flac',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/mpeg'
  ];
  
  if (!allowedTypes.some(type => mimetype.includes(type.split('/')[1]))) {
    throw new Error(`Unsupported media type: ${mimetype}`);
  }
};

/**
 * Convert MIME type to file extension
 * @param {string} mimetype - Original MIME type
 * @returns {string} File extension
 */
const getFileExtension = (mimetype) => {
  const mimeMap = {
    'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav',
    'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/m4a': 'm4a',
    'audio/flac': 'flac',
    'video/mp4': 'mp4', 'video/webm': 'webm',
    'video/quicktime': 'mov', 'video/mpeg': 'mpeg'
  };
  
  for (const [mime, ext] of Object.entries(mimeMap)) {
    if (mimetype.includes(mime.split('/')[1])) {
      return ext;
    }
  }
  
  return 'mp3'; // Default fallback
};

/**
 * Transcribe audio/video using OpenAI gpt-4o-transcribe
 * @param {Buffer} audioBuffer - Audio/video file buffer
 * @param {string} mimetype - MIME type
 * @returns {Promise<{transcript: string, model: string, processingTime: number}>}
 */
export const transcribe = async (audioBuffer, mimetype) => {
  const startTime = Date.now();
  
  try {
    validateMediaFile(audioBuffer, mimetype);
    
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set. OpenAI is required for transcription.');
    }
    
    console.log(`[Transcription] Starting transcription with ${MODEL}...`);
    
    const openai = getOpenAIClient();
    
    // Create temporary file for OpenAI API
    const tempFilePath = path.join(__dirname, `temp_audio_${Date.now()}.${getFileExtension(mimetype)}`);
    
    try {
      // Write buffer to temporary file
      fs.writeFileSync(tempFilePath, audioBuffer);
      
      // Create File object for OpenAI
      let file;
      if (typeof File !== 'undefined') {
        file = new File([audioBuffer], `audio.${getFileExtension(mimetype)}`, { type: mimetype });
      } else {
        file = fs.createReadStream(tempFilePath);
      }
      
      // Call OpenAI transcription API
      const transcription = await openai.audio.transcriptions.create({
        file: file,
        model: MODEL,
        language: 'en',
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
      
      const processingTime = Date.now() - startTime;
      console.log(`[Transcription] Success | Model: ${MODEL} | Length: ${transcript.length} chars | Time: ${processingTime}ms`);
      
      return {
        transcript: transcript.trim(),
        model: MODEL,
        processingTime
      };
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
    const processingTime = Date.now() - startTime;
    console.error(`[Transcription] Error | Model: ${MODEL} | Time: ${processingTime}ms | Error:`, error.message);
    
    // Provide helpful error messages
    if (error.message?.includes('API key')) {
      throw new Error('OpenAI API key is invalid or missing. Check OPENAI_API_KEY environment variable.');
    }
    
    if (error.message?.includes('file size')) {
      throw new Error(`File size exceeds OpenAI's limit of ${MAX_AUDIO_SIZE / 1024 / 1024}MB`);
    }
    
    // Return structured error response
    throw {
      error: 'Transcription failed',
      message: error.message,
      model: MODEL,
      processingTime: Date.now() - startTime
    };
  }
};

export default {
  transcribe
};
