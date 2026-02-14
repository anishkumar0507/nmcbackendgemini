import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import puppeteerCore from 'puppeteer-core';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import axios from 'axios';
import cheerio from 'cheerio';

puppeteerExtra.use(StealthPlugin());
const puppeteer = puppeteerExtra.addExtra(puppeteerCore);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function hybridScrape(url) {
  // Puppeteer attempt
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('body', { timeout: 15000 });
    await delay(1500); // Use custom delay, not page.waitForTimeout
    const text = await page.evaluate(() => document.body.innerText);
    await browser.close();
    if (text && text.trim()) {
      console.log('[HybridScrape] Puppeteer succeeded');
      return text.trim();
    }
  } catch (err) {
    console.warn('[HybridScrape] Puppeteer failed:', err.message);
  }

  // Readability fallback
  try {
    const { data: html } = await axios.get(url, { timeout: 30000 });
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();
    if (article && article.textContent) {
      console.log('[HybridScrape] Readability succeeded');
      return article.textContent.trim();
    }
  } catch (err) {
    console.warn('[HybridScrape] Readability failed:', err.message);
  }

  // Cheerio fallback
  try {
    const { data: html } = await axios.get(url, { timeout: 30000 });
    const $ = cheerio.load(html);
    $('script, style, nav, footer').remove();
    const text = $('body').text();
    if (text && text.trim()) {
      console.log('[HybridScrape] Cheerio succeeded');
      return text.replace(/\s+/g, ' ').trim();
    }
  } catch (err) {
    console.warn('[HybridScrape] Cheerio failed:', err.message);
  }

  // All methods failed
  console.error('[HybridScrape] All scraping methods failed');
  return '';
}
