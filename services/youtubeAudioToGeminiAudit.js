import ytdl from 'ytdl-core';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { transcribe } from './transcriptionService.js';
import { analyzeWithGemini } from '../geminiService.js';

const TMP_DIR = '/tmp';
const MAX_DURATION_SEC = 600; // 10 minutes
const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

function isYouTubeUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be');
  } catch {
    return false;
  }
}

function extractVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.replace('/', '').trim() || null;
    }
    if (u.searchParams.has('v')) {
      return u.searchParams.get('v');
    }
    const pathParts = u.pathname.split('/').filter(Boolean);
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
}

async function downloadYouTubeAudio(url) {
  console.log('[YouTube] Audio downloading');
  if (!ytdl.validateURL(url)) {
    return { error: 'Invalid YouTube URL.' };
  }
  try {
    const info = await ytdl.getInfo(url);
    const durationSec = parseInt(info.videoDetails.lengthSeconds, 10);
    if (durationSec > MAX_DURATION_SEC) {
      return { error: `Video duration exceeds ${MAX_DURATION_SEC / 60} minutes.` };
    }
    const fileName = `yt_audio_${Date.now()}.webm`;
    const filePath = path.join(TMP_DIR, fileName);
    const audioStream = ytdl(url, { filter: 'audioonly', quality: 'highestaudio' });
    const writeStream = fs.createWriteStream(filePath);
    let size = 0;
    audioStream.on('data', (chunk) => { size += chunk.length; });
    const finished = new Promise((resolve, reject) => {
      audioStream.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      audioStream.on('error', reject);
    });
    await finished;
    if (size > MAX_SIZE_BYTES) {
      fs.unlinkSync(filePath);
      return { error: `Audio file exceeds ${(MAX_SIZE_BYTES / 1024 / 1024).toFixed(1)}MB.` };
    }
    console.log('[YouTube] Audio downloaded');
    return { filePath, duration: durationSec, size };
  } catch (err) {
    return { error: `Failed to download audio: ${err.message}` };
  }
}

async function convertToMp3(inputPath) {
  const outputPath = inputPath.replace(/\.[^.]+$/, '.mp3');
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec('libmp3lame')
      .format('mp3')
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .save(outputPath);
  });
}

export async function youtubeAudioToGeminiAudit(url) {
  if (!isYouTubeUrl(url)) {
    return { error: 'Not a YouTube URL.' };
  }
  const videoId = extractVideoId(url);
  if (!videoId) {
    return { error: 'Invalid YouTube video URL.' };
  }
  let filePath, mp3Path;
  try {
    // Step 2: Download audio
    const downloadResult = await downloadYouTubeAudio(url);
    if (downloadResult.error) return { error: downloadResult.error };
    filePath = downloadResult.filePath;
    // Step 3: Normalize audio
    mp3Path = await convertToMp3(filePath);
    const audioBuffer = fs.readFileSync(mp3Path);
    // Step 4: Transcribe
    console.log('[OpenAI] Transcription started');
    const transcriptResult = await transcribe(audioBuffer, 'audio/mp3');
    if (!transcriptResult.transcript || transcriptResult.transcript.length < 10) {
      throw new Error('Transcription failed or too short.');
    }
    console.log('[OpenAI] Transcription completed');
    // Step 5: Gemini audit
    console.log('[Gemini] Audit started');
    const auditResult = await analyzeWithGemini({
      content: transcriptResult.transcript,
      inputType: 'video',
      category: 'youtube',
      analysisMode: 'default'
    });
    console.log('[Gemini] Audit completed');
    return {
      ok: true,
      transcript: transcriptResult.transcript,
      audit: auditResult
    };
  } catch (err) {
    return { error: err.message || 'Unknown error in YouTube audio audit.' };
  } finally {
    // Clean up temp files
    try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
    try { if (mp3Path && fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path); } catch {}
  }
}
