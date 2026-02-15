
import axios from 'axios';
import { JSDOM } from 'jsdom';
import getYoutubeTranscript from 'youtube-transcript';
import { analyzeWithGemini } from '../geminiService.js';

function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isYoutubeUrl(url) {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//.test(url);
}

function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')
    .split('\n')
    .map(line => line.trim())
    .filter((line, idx, arr) => line && arr.indexOf(line) === idx)
    .join(' ')
    .trim();
}

function limitWords(text, maxWords = 8000) {
  const words = text.split(/\s+/);
  return words.slice(0, maxWords).join(' ');
}

export const auditBlogController = async (req, res) => {
  const { url } = req.body;
  if (!isValidUrl(url)) {
    return res.status(400).json({ success: false, message: 'Invalid URL' });
  }

  try {
    // YouTube special handling
    if (isYoutubeUrl(url)) {
      try {
        const transcript = await getYoutubeTranscript(url);
        const text = transcript.map(t => t.text).join(' ');
        return res.json({
          success: true,
          type: 'youtube',
          wordCount: text.split(/\s+/).length,
          content: limitWords(cleanText(text)),
        });
      } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch YouTube transcript' });
      }
    }

    // Blog/article scraping
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      maxContentLength: 2 * 1024 * 1024,
      maxBodyLength: 2 * 1024 * 1024,
    });

    const dom = new JSDOM(response.data);
    const document = dom.window.document;

    // Remove unwanted tags
    ['script', 'style', 'noscript', 'iframe', 'nav', 'footer', 'header', 'svg'].forEach(tag => {
      document.querySelectorAll(tag).forEach(el => el.remove());
    });

    // Extract title
    const title = document.querySelector('title')?.textContent?.trim() || '';
    // Extract meta description
    const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';

    // Extract headings
    const headings = [];
    ['h1', 'h2', 'h3'].forEach(h => {
      document.querySelectorAll(h).forEach(el => {
        headings.push({ tag: h, text: cleanText(el.textContent || '') });
      });
    });

    // Extract paragraph text
    let content = Array.from(document.querySelectorAll('p'))
      .map(p => cleanText(p.textContent || ''))
      .join(' ');
    if (!content || content.length < 20) {
      content = cleanText(document.body?.textContent || '');
    }
    content = limitWords(content);

    // Word count
    const wordCount = content.split(/\s+/).filter(Boolean).length;

    // Internal and external links
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map(a => a.getAttribute('href'))
      .filter(Boolean);
    const baseUrl = new URL(url);
    const internalLinks = links.filter(link => {
      try {
        const abs = new URL(link, baseUrl);
        return abs.hostname === baseUrl.hostname;
      } catch {
        return false;
      }
    });
    const externalLinks = links.filter(link => {
      try {
        const abs = new URL(link, baseUrl);
        return abs.hostname !== baseUrl.hostname;
      } catch {
        return false;
      }
    });

    // --- Gemini Compliance Analysis ---
    let geminiResponse;
    try {
      geminiResponse = await analyzeWithGemini({
        content,
        inputType: 'webpage',
        category: undefined,
        analysisMode: undefined
      });
    } catch (geminiErr) {
      console.error('[Gemini] API call failed:', geminiErr);
      return res.status(500).json({ success: false, error: 'Gemini API call failed' });
    }

    // Null/structure checks
    if (!geminiResponse || !geminiResponse.candidates || !Array.isArray(geminiResponse.candidates) ||
        !geminiResponse.candidates[0] || !geminiResponse.candidates[0].content ||
        !geminiResponse.candidates[0].content.parts || !Array.isArray(geminiResponse.candidates[0].content.parts) ||
        !geminiResponse.candidates[0].content.parts[0] ||
        typeof geminiResponse.candidates[0].content.parts[0].text !== 'string') {
      return res.status(500).json({ success: false, error: 'Invalid Gemini response structure' });
    }

    const rawText = geminiResponse.candidates[0].content.parts[0].text;
    console.log('[Gemini] Raw response:', rawText);
    let parsed;
    try {
      parsed = JSON.parse(rawText);
      return res.json({
        success: true,
        type: 'blog',
        title,
        metaDescription,
        headings,
        wordCount,
        internalLinks,
        externalLinks,
        content,
        gemini: parsed
      });
    } catch (err) {
      // If not valid JSON, fallback: return as plain text
      if (rawText && typeof rawText === 'string') {
        return res.json({
          success: true,
          type: 'blog',
          title,
          metaDescription,
          headings,
          wordCount,
          internalLinks,
          externalLinks,
          content,
          gemini: { data: rawText }
        });
      } else {
        return res.status(500).json({ success: false, error: 'Invalid JSON from Gemini' });
      }
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to audit blog' });
  }
};
