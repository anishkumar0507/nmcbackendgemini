import { YoutubeTranscript } from 'youtube-transcript';
// import youtubei.js if available in your dependencies

async function tryYoutubeTranscript(videoId) {
  try {
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
    if (transcriptItems && transcriptItems.length) {
      const transcript = transcriptItems.map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim();
      if (transcript) {
        console.log('[HybridTranscript] youtube-transcript succeeded');
        return transcript;
      }
    }
  } catch (err) {
    console.warn('[HybridTranscript] youtube-transcript failed:', err.message);
  }
  return null;
}

async function tryYoutubei(videoId) {
  // Placeholder: implement with youtubei.js if available
  // Return null if not implemented
  return null;
}

function extractYouTubeVideoId(url) {
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
}

export async function hybridYouTubeTranscript(url) {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    return { error: 'Transcript not available for this video.' };
  }

  // 1. Try youtube-transcript
  const transcript1 = await tryYoutubeTranscript(videoId);
  if (transcript1) return { transcript: transcript1 };

  // 2. Try youtubei.js (if implemented)
  const transcript2 = await tryYoutubei(videoId);
  if (transcript2) return { transcript: transcript2 };

  // 3. All failed
  return { error: 'Transcript not available for this video.' };
}
