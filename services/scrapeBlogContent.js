import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

/**
 * Scrape blog content using jsdom and Readability
 * @param {string} url
 * @returns {Promise<{ title: string, content: string } | { error: string }>}
 */
export async function scrapeBlogContent(url) {
  console.log('[Scraping] Attempt started:', url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
  try {
    let response;
    try {
      response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal
      });
    } catch (err) {
      clearTimeout(timeout);
      console.log('[Scraping] Failed:', err.message);
      return { error: 'Failed to fetch URL: ' + err.message };
    }
    clearTimeout(timeout);
    if (!response.ok) {
      console.log('[Scraping] Failed: HTTP', response.status);
      if (response.status === 403) {
        return { error: 'Access denied or bot protection (HTTP 403).' };
      }
      return { error: `HTTP error: ${response.status}` };
    }
    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (!article || !article.textContent || article.textContent.trim().length < 30) {
      console.log('[Scraping] Failed: No readable content');
      return { error: 'No readable article content found.' };
    }
    console.log('[Scraping] Success:', url);
    return {
      title: article.title || '',
      content: article.textContent.trim()
    };
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      console.log('[Scraping] Failed: Timeout');
      return { error: 'Request timed out (10s).' };
    }
    console.log('[Scraping] Failed:', err.message);
    return { error: 'Scraping failed: ' + err.message };
  }
}
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

/**
 * Scrape blog content using jsdom and Readability
 * @param {string} url
 * @returns {Promise<{ title: string, content: string } | { error: string }>}
 */
export async function scrapeBlogContent(url) {
  console.log('[Scraping] Attempt started:', url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
  try {
    let response;
    try {
      response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal
      });
    } catch (err) {
      clearTimeout(timeout);
      console.log('[Scraping] Failed:', err.message);
      return { error: 'Failed to fetch URL: ' + err.message };
    }
    clearTimeout(timeout);
    if (!response.ok) {
      console.log('[Scraping] Failed: HTTP', response.status);
      if (response.status === 403) {
        return { error: 'Access denied or bot protection (HTTP 403).' };
      }
      return { error: `HTTP error: ${response.status}` };
    }
    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (!article || !article.textContent || article.textContent.trim().length < 30) {
      console.log('[Scraping] Failed: No readable content');
      return { error: 'No readable article content found.' };
    }
    console.log('[Scraping] Success:', url);
    return {
      title: article.title || '',
      content: article.textContent.trim()
    };
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      console.log('[Scraping] Failed: Timeout');
      return { error: 'Request timed out (10s).' };
    }
    console.log('[Scraping] Failed:', err.message);
    return { error: 'Scraping failed: ' + err.message };
  }
}
