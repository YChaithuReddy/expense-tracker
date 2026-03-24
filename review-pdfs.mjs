import { chromium } from 'C:/Users/chath/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';

const OUT = 'C:/Users/chath/Documents/Python code/expense tracker';

const browser = await chromium.launch({ headless: true });

// LOGIN PAGE desktop
const ctx1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const login = await ctx1.newPage();
await login.goto('https://expense-tracker-delta-ashy.vercel.app/login.html', { waitUntil: 'networkidle', timeout: 20000 });
await login.screenshot({ path: `${OUT}/review-login-desktop-1440.png`, fullPage: true });
await login.setViewportSize({ width: 375, height: 812 });
await login.screenshot({ path: `${OUT}/review-login-mobile-375.png`, fullPage: true });
await ctx1.close();

// PDFS page
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const pdfs = await ctx2.newPage();
const consoleErrors = [];
pdfs.on('console', m => { if (['error','warning'].includes(m.type())) consoleErrors.push(m.type()+': '+m.text()); });
await pdfs.goto('https://expense-tracker-delta-ashy.vercel.app/pdfs.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
await pdfs.waitForTimeout(3500);
const finalUrl = pdfs.url();
const finalTitle = await pdfs.title();
await pdfs.screenshot({ path: `${OUT}/review-pdfs-desktop-1440.png`, fullPage: true });

// Viewport: 900
await pdfs.setViewportSize({ width: 900, height: 900 });
await pdfs.screenshot({ path: `${OUT}/review-pdfs-900.png`, fullPage: false });

// Tablet
await pdfs.setViewportSize({ width: 768, height: 1024 });
await pdfs.screenshot({ path: `${OUT}/review-pdfs-tablet-768.png`, fullPage: true });

// Mobile
await pdfs.setViewportSize({ width: 375, height: 812 });
await pdfs.screenshot({ path: `${OUT}/review-pdfs-mobile-375.png`, fullPage: true });

console.log('Final URL:', finalUrl);
console.log('Title:', finalTitle);
console.log('Console issues:', consoleErrors.slice(0,10).join('\n'));

await ctx2.close();
await browser.close();
console.log('Screenshots saved.');
