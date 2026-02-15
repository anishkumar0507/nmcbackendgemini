
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';


const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function getFetch() {
  if (typeof globalThis.fetch === 'function') return globalThis.fetch;
  const mod = await import('node-fetch');
  return mod.default || mod;
}


export async function scrapeBlogContent(url) {
  console.log('[Scraping] Attempt started:', url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const fetchFn = await getFetch();
    const response = await fetchFn(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) {
      if (response.status === 403) {
        return { error: true, content: '', title: '', message: 'Access denied or bot protection (HTTP 403).' };
      }
      return { error: true, content: '', title: '', message: `HTTP error: ${response.status}` };
    }
    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (!article?.textContent) {
      return { error: true, content: '', title: '', message: 'No readable article content found.' };
    }
    return {
      error: false,
      title: article.title || '',
      content: article.textContent.trim(),
      message: 'Scraping successful'
    };
  } catch (err) {
    clearTimeout(timeout);
    return { error: true, content: '', title: '', message: err.message || 'Scraping failed' };
  }
}
