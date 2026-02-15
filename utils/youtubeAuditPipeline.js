import ytdl from 'ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { transcribe } from '../services/transcriptionService.js';
import { analyzeWithGemini } from '../geminiService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR = '/tmp';
const MAX_DURATION = 10 * 60; // 10 minutes in seconds
const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB

function isYouTubeUrl(url) {
  return /(?:youtube\.com\/watch\?v=|youtu\.be\/)/.test(url);
}

function extractVideoId(url) {
  try {
    const id = ytdl.getURLVideoID(url);
    return id;
  } catch (e) {
    throw new Error('Invalid YouTube URL');
  }
}

async function downloadAudio(videoId) {
  const info = await ytdl.getInfo(videoId);
  const duration = parseInt(info.videoDetails.lengthSeconds, 10);
  if (duration > MAX_DURATION) {
    throw new Error('Video duration exceeds 10 minutes limit');
  }
  const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
  if (!audioFormat) {
    throw new Error('No suitable audio stream found');
  }
  const tempFile = path.join(TMP_DIR, `yt_audio_${videoId}_${Date.now()}.webm`);
  return new Promise((resolve, reject) => {
    console.log('[YouTube] Audio downloading:', videoId);
    ytdl.downloadFromInfo(info, { format: audioFormat })
      .pipe(fs.createWriteStream(tempFile))
      .on('finish', () => {
        console.log('[YouTube] Audio downloaded:', tempFile);
        resolve({ tempFile, duration });
      })
      .on('error', (err) => {
        console.error('[YouTube] Audio download error:', err);
        reject(new Error('Failed to download audio'));
      });
  });
}

async function normalizeAudio(inputPath) {
  const outputPath = inputPath.replace(/\.webm$/, '.mp3');
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec('libmp3lame')
      .format('mp3')
      .on('end', () => {
        fs.stat(outputPath, (err, stats) => {
          if (err || stats.size > MAX_AUDIO_SIZE) {
            reject(new Error('Normalized audio exceeds 25MB or not found'));
          } else {
            resolve(outputPath);
          }
        });
      })
      .on('error', (err) => {
        console.error('[YouTube] Audio normalization error:', err);
        reject(new Error('Failed to normalize audio'));
      })
      .save(outputPath);
  });
}

async function youtubeAuditPipeline(url) {
  if (!isYouTubeUrl(url)) {
    return { error: 'URL is not a valid YouTube video' };
  }
  let videoId, tempFile, normalizedFile;
  try {
    videoId = extractVideoId(url);
    // Try YouTube transcript first
    let transcript = null;
    try {
      // Placeholder: Replace with actual transcript fetch logic
      // transcript = await fetchYouTubeTranscript(videoId);
      transcript = null; // Simulate transcript disabled
    } catch (transcriptErr) {
      console.log('[YouTube] Transcript disabled');
    }
    if (!transcript) {
      console.log('[YouTube] Transcript disabled');
      // Fallback to audio transcription
      const { tempFile: downloadedFile, duration } = await downloadAudio(videoId);
      tempFile = downloadedFile;
      normalizedFile = await normalizeAudio(tempFile);
      const audioBuffer = fs.readFileSync(normalizedFile);
      if (audioBuffer.length > MAX_AUDIO_SIZE) {
        throw new Error('Audio file exceeds 25MB limit');
      }
      console.log('[OpenAI] Transcription started');
      const transcriptResult = await transcribe(audioBuffer, 'audio/mp3');
      console.log('[OpenAI] Transcription completed');
      transcript = transcriptResult.transcript;
      if (!transcript || transcript.length < 50) {
        return { error: 'Transcript too short or empty. Unable to audit.', transcriptLength: transcript.length };
      }
      console.log('[Gemini] Audit started');
      const auditResult = await analyzeWithGemini({ content: transcript, inputType: 'audio' });
      console.log('[Gemini] Audit completed');
      return {
        transcript,
        audit: auditResult,
        model: transcriptResult.model,
        processingTime: transcriptResult.processingTime
      };
    } else {
      // If transcript exists and is valid
      if (transcript.length < 50) {
        return { error: 'Transcript too short or empty. Unable to audit.', transcriptLength: transcript.length };
      }
      console.log('[Gemini] Audit started');
      const auditResult = await analyzeWithGemini({ content: transcript, inputType: 'audio' });
      console.log('[Gemini] Audit completed');
      return {
        transcript,
        audit: auditResult,
        model: 'youtube-transcript',
        processingTime: null
      };
    }
  } catch (err) {
    console.error('[YouTube Pipeline] Error:', err.message);
    return {
      error: 'YouTube audit pipeline failed',
      message: err.message
    };
  } finally {
    // Clean up temp files
    try {
      if (tempFile && fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      if (normalizedFile && fs.existsSync(normalizedFile)) fs.unlinkSync(normalizedFile);
    } catch (cleanupErr) {
      console.warn('[YouTube Pipeline] Temp file cleanup failed:', cleanupErr.message);
    }
  }
}

export { youtubeAuditPipeline, isYouTubeUrl };
