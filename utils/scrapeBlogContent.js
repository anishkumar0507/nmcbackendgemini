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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SatarkAI/1.0; +https://nextcomplyai.com/bot)'
      },
      signal: controller.signal
    });
    if (!response.ok) {
      const msg = `[Scraping] Failed: HTTP ${response.status}`;
      console.error(msg);
      throw new Error(response.status === 403 ? 'Access denied or bot protection' : `Failed to fetch: HTTP ${response.status}`);
    }
    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (!article || !article.textContent || !article.title) {
      console.error('[Scraping] Failed: No readable content');
      throw new Error('No readable article content found');
    }
    const content = article.textContent.trim();
    const title = article.title.trim();
    if (!content) {
      console.error('[Scraping] Failed: Empty content');
      throw new Error('Extracted content is empty');
    }
    console.log('[Scraping] Success:', title);
    return { title, content };
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('[Scraping] Failed: Timeout');
      throw new Error('Scraping timed out (10s limit)');
    }
    console.error('[Scraping] Failed:', err.message);
    throw new Error(`Scraping failed: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }
}
