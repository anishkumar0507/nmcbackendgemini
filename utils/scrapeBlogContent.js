import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

/**
 * Scrape and extract readable blog/article content from a URL
 * @param {string} url - The URL to scrape
 * @returns {Promise<{title: string, content: string}>}
 */
export async function scrapeBlogContent(url) {
  console.log('[Scraping] Attempt started:', url);
  // Validate URL
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    console.error('[Scraping] Failed: Invalid URL format');
    return { error: true, message: 'Invalid URL format' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
  let response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timeout);
    console.error('[Scraping] Failed: Fetch error', err.message);
    return { error: true, message: 'Fetch failed: ' + err.message };
  }
  clearTimeout(timeout);

  if (!response.ok) {
    console.error(`[Scraping] Failed: HTTP ${response.status}`);
    let msg = response.status === 403 ? 'Access denied or bot protection' : `Fetch failed with status ${response.status}`;
    return { error: true, message: msg };
  }

  let html;
  try {
    html = await response.text();
  } catch (err) {
    console.error('[Scraping] Failed: Unable to read HTML', err.message);
    return { error: true, message: 'Unable to read HTML: ' + err.message };
  }

  let dom, article;
  try {
    dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    article = reader.parse();
  } catch (err) {
    console.error('[Scraping] Failed: JSDOM/Readability error', err.message);
    return { error: true, message: 'Unable to parse content: ' + err.message };
  }

  if (!article || !article.textContent || article.textContent.trim().length < 50) {
    console.error('[Scraping] Failed: No readable content found');
    return { error: true, message: 'Unable to extract readable content' };
  }

  // Limit content length
  let content = article.textContent.trim();
  if (content.length > 80000) {
    content = content.slice(0, 80000);
  }

  console.log('[Scraping] Success:', url);
  return {
    title: article.title || '',
    content
  };
}
