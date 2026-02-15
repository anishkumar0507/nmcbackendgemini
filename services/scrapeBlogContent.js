import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

export async function scrapeBlogContent(url) {
  console.log('[Scraping] Attempt started:', url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 403) {
        return { error: 'Access denied or bot protection (HTTP 403).' };
      }
      return { error: `HTTP error: ${response.status}` };
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url });

    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article?.textContent) {
      return { error: 'No readable article content found.' };
    }

    return {
      title: article.title || '',
      content: article.textContent.trim()
    };

  } catch (err) {
    clearTimeout(timeout);
    return { error: err.message };
  }
}
