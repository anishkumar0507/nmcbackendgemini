import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

/**
 * Web Scraping Service
 * Extracts visible marketing claims from web pages
 */

const MAX_CONTENT_LENGTH = 50000; // Limit scraped content to 50KB
const REQUEST_TIMEOUT = 10000; // 10 seconds

/**
 * Sanitize scraped content
 * @param {string} text - Raw text content
 * @returns {string} Sanitized text
 */
const sanitizeContent = (text) => {
  if (!text) return '';
  
  // Remove excessive whitespace
  let sanitized = text.replace(/\s+/g, ' ').trim();
  
  // Limit length
  if (sanitized.length > MAX_CONTENT_LENGTH) {
    sanitized = sanitized.substring(0, MAX_CONTENT_LENGTH) + '...';
  }
  
  return sanitized;
};

/**
 * Extract visible text from HTML
 * @param {string} html - HTML content
 * @returns {string} Extracted text
 */
const extractVisibleText = (html) => {
  try {
    const $ = cheerio.load(html);
    
    // Remove script and style elements
    $('script, style, noscript').remove();
    
    // Extract text from common content containers
    const selectors = [
      'h1, h2, h3, h4, h5, h6',
      'p',
      'div[class*="content"]',
      'div[class*="text"]',
      'article',
      'section',
      'main',
      '.advertisement',
      '.ad',
      '.marketing',
      '.claim',
      '[data-ad]',
      '[data-marketing]'
    ];
    
    let extractedText = '';
    
    selectors.forEach(selector => {
      $(selector).each((_, element) => {
        const text = $(element).text().trim();
        if (text) {
          extractedText += text + ' ';
        }
      });
    });
    
    // Fallback: extract all text if selectors didn't work
    if (!extractedText.trim()) {
      extractedText = $('body').text();
    }
    
    return sanitizeContent(extractedText);
  } catch (error) {
    console.error('[Scraping] Error extracting text:', error);
    throw new Error('Failed to extract text from webpage');
  }
};

/**
 * Scrape webpage and extract marketing content
 * @param {string} url - URL to scrape
 * @returns {Promise<{extractedText: string, url: string}>}
 */
export const scrapeUrl = async (url) => {
  try {
    // Validate URL
    try {
      new URL(url);
    } catch {
      throw new Error('Invalid URL format');
    }

    console.log(`[Scraping] Fetching URL: ${url}`);
    
    // Fetch webpage with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    const extractedText = extractVisibleText(html);
    
    if (!extractedText.trim()) {
      throw new Error('No extractable content found on webpage');
    }
    
    console.log(`[Scraping] Extracted ${extractedText.length} characters`);
    
    return {
      extractedText,
      url
    };
  } catch (error) {
    console.error('[Scraping] Error:', error);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout: URL took too long to respond');
    }
    throw new Error(`Failed to scrape URL: ${error.message}`);
  }
};

export default { scrapeUrl };
