// Utility for downloading YouTube audio using ytdl-core
import ytdl from 'ytdl-core';
import fs from 'fs';
import path from 'path';

/**
 * Download YouTube audio to a temp file (mp3)
 * @param {string} url - YouTube video URL
 * @param {string} tempDir - Directory to save temp file
 * @param {number} maxDurationSec - Max allowed duration in seconds
 * @param {number} maxSizeBytes - Max allowed file size in bytes
 * @returns {Promise<{ filePath: string, duration: number, size: number }>} Temp file path, duration, and size
 */
export async function downloadYouTubeAudio(url, tempDir, maxDurationSec, maxSizeBytes) {
  if (!ytdl.validateURL(url)) {
    return { error: 'Invalid YouTube URL.' };
  }
  try {
    const info = await ytdl.getInfo(url);
    const durationSec = parseInt(info.videoDetails.lengthSeconds, 10);
    if (durationSec > maxDurationSec) {
      return { error: `Video duration exceeds ${maxDurationSec / 60} minutes.` };
    }
    const fileName = `yt_audio_${Date.now()}.mp3`;
    const filePath = path.join(tempDir, fileName);
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
    if (size > maxSizeBytes) {
      fs.unlinkSync(filePath);
      return { error: `Audio file exceeds ${(maxSizeBytes / 1024 / 1024).toFixed(1)}MB.` };
    }
    return { filePath, duration: durationSec, size };
  } catch (err) {
    return { error: `Failed to download audio: ${err.message}` };
  }
}
