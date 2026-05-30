const { chromium } = require('playwright');
const fs = require('fs');

const VIEWPORT = { width: 375, height: 812 };
const BASE = 'https://expense-tracker-delta-ashy.vercel.app';
const OUT = 'C:/Users/chath/Documents/Python code/expense tracker/audit_screenshots';

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function screenshot(page, name) {
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file, fullPage: false });
  console.log('SCREENSHOT: ' + file);
  return file;
}

async function scrollShot(page, prefix) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await screenshot(page, prefix + '_top');
  const totalH = await page.evaluate(() => document.body.scrollHeight);
  if (totalH > 900) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(400);
    await screenshot(page, prefix + '_mid');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
    await screenshot(page, prefix + '_bottom');
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function getOverflow(page) {
  return page.evaluate(() => ({
    horizontal: document.body.scrollWidth > window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth
  }));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await context.newPage();

  const consoleErrors = {};
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const url = page.url();
      if (!consoleErrors[url]) consoleErrors[url] = [];
      consoleErrors[url].push(msg.text());
    }
  });

  // ===== 1. LOGIN PAGE =====
  console.log('\n=== LOGIN PAGE ===');
  await page.goto(BASE + '/login.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await scrollShot(page, '01_login');

  const loginData = await page.evaluate(() => {
    const bodyOF = document.body.scrollWidth > window.innerWidth;

    // Left panel check
    const leftSelectors = ['.left-panel', '.login-left', '.auth-left', '.split-left', '.hero-panel'];
    let leftPanel = null;
    for (const s of leftSelectors) {
      const el = document.querySelector(s);
      if (el) {
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        leftPanel = { selector: s, display: st.display, width: Math.round(r.width), x: Math.round(r.x), hidden: st.display === 'none' || st.visibility === 'hidden' };
        break;
      }
    }

    // Buttons
    const btns = Array.from(document.querySelectorAll('button, [type="submit"], .btn')).map(el => {
      const r = el.getBoundingClientRect();
      return { text: el.textContent.trim().substring(0, 50), w: Math.round(r.width), h: Math.round(r.height), visible: r.width > 0 && r.height > 0 };
    }).filter(b => b.visible);

    // Form
    const form = document.querySelector('form');
    const formR = form ? form.getBoundingClientRect() : null;

    // Input fields
    const inputs = Array.from(document.querySelectorAll('input')).map(el => {
      const r = el.getBoundingClientRect();
      return { type: el.type, w: Math.round(r.width), h: Math.round(r.height), visible: r.width > 0 };
    }).filter(i => i.visible);

    return { bodyOF, leftPanel, btns, formBottom: formR ? Math.round(formR.bottom) : null, viewportH: window.innerHeight, inputs };
  });
  console.log('LOGIN DATA:', JSON.stringify(loginData, null, 2));

  // ===== 2. SIGNUP PAGE =====
  console.log('\n=== SIGNUP PAGE ===');
  await page.goto(BASE + '/signup.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await scrollShot(page, '02_signup');

  const signupData = await page.evaluate(() => {
    const bodyOF = document.body.scrollWidth > window.innerWidth;

    const btns = Array.from(document.querySelectorAll('button, [type="submit"], .btn')).map(el => {
      const r = el.getBoundingClientRect();
      return { text: el.textContent.trim().substring(0, 50), w: Math.round(r.width), h: Math.round(r.height), visible: r.width > 0 && r.height > 0 };
    }).filter(b => b.visible);

    const inputs = Array.from(document.querySelectorAll('input')).map(el => {
      const r = el.getBoundingClientRect();
      return { type: el.type, placeholder: el.placeholder, w: Math.round(r.width), h: Math.round(r.height), visible: r.width > 0 };
    }).filter(i => i.visible);

    const pwToggle = document.querySelector('.toggle-password, [data-toggle-password], .password-toggle, .eye-icon');
    let toggleInfo = null;
    if (pwToggle) {
      const r = pwToggle.getBoundingClientRect();
      toggleInfo = { w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) };
    }

    return { bodyOF, btns, inputs, toggleInfo };
  });
  console.log('SIGNUP DATA:', JSON.stringify(signupData, null, 2));

  // ===== 3. INDEX PAGE =====
  console.log('\n=== INDEX PAGE (direct) ===');
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  console.log('Index URL:', page.url());
  await scrollShot(page, '03_index');

  const indexData = await page.evaluate(() => {
    // Bottom nav
    const navSel = ['.bottom-nav', '.tab-bar', 'nav.mobile-nav', '[class*="bottom-nav"]', '[class*="bottomnav"]'];
    let navInfo = null;
    for (const s of navSel) {
      const el = document.querySelector(s);
      if (el) {
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        const items = el.querySelectorAll('a, button');
        navInfo = {
          selector: s,
          display: st.display,
          position: st.position,
          height: Math.round(r.height),
          bottom: Math.round(r.bottom),
          itemCount: items.length,
          visible: r.height > 0 && st.display !== 'none'
        };
        break;
      }
    }

    // Scan button / FAB
    const fabSel = ['.scan-fab', '.fab', '.scan-btn', '[class*="scan-fab"]', '[class*="center-btn"]'];
    let fabInfo = null;
    for (const s of fabSel) {
      const el = document.querySelector(s);
      if (el) {
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        fabInfo = { selector: s, w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom), transform: st.transform };
        break;
      }
    }

    // Action cards grid
    const actionCards = Array.from(document.querySelectorAll('.action-card, .quick-action, [class*="action-card"]')).map(el => {
      const r = el.getBoundingClientRect();
      return { class: el.className.substring(0, 60), w: Math.round(r.width), h: Math.round(r.height), visible: r.width > 0 };
    }).filter(c => c.visible);

    // Btn-flux buttons
    const fluxBtns = Array.from(document.querySelectorAll('.btn-flux, [class*="btn-flux"]')).map(el => {
      const r = el.getBoundingClientRect();
      const st = window.getComputedStyle(el);
      return {
        text: el.textContent.trim().substring(0, 50),
        w: Math.round(r.width),
        h: Math.round(r.height),
        overflow: st.overflow,
        whiteSpace: st.whiteSpace,
        visible: r.width > 0
      };
    }).filter(b => b.visible);

    // Main content padding
    const main = document.querySelector('main, .main-content, .content-area, #main');
    const mainStyle = main ? window.getComputedStyle(main) : null;

    // Horizontal overflow
    const horizOF = document.body.scrollWidth > window.innerWidth;

    // Submit button
    const submitBtn = document.querySelector('[class*="submit"], [class*="reimburs"]');
    const submitInfo = submitBtn ? (() => {
      const r = submitBtn.getBoundingClientRect();
      return { text: submitBtn.textContent.trim().substring(0, 60), w: Math.round(r.width), h: Math.round(r.height) };
    })() : null;

    return {
      navInfo,
      fabInfo,
      actionCards,
      fluxBtns,
      mainPaddingBottom: mainStyle ? mainStyle.paddingBottom : null,
      horizOF,
      submitBtn: submitInfo
    };
  });
  console.log('INDEX DATA:', JSON.stringify(indexData, null, 2));

  // Additional deep scroll check for index
  const indexScrollInfo = await page.evaluate(() => {
    const totalHeight = document.body.scrollHeight;
    const viewportH = window.innerHeight;

    // Find all elements that go outside viewport width
    const overflowEls = Array.from(document.querySelectorAll('*')).filter(el => {
      const r = el.getBoundingClientRect();
      return r.right > window.innerWidth + 5 || r.left < -5;
    }).map(el => ({
      tag: el.tagName,
      class: el.className.substring(0, 50),
      right: Math.round(el.getBoundingClientRect().right),
      left: Math.round(el.getBoundingClientRect().left)
    })).slice(0, 20);

    return { totalHeight, viewportH, scrollable: totalHeight > viewportH, overflowEls };
  });
  console.log('INDEX SCROLL INFO:', JSON.stringify(indexScrollInfo, null, 2));

  // ===== 4. ACCOUNTANT PAGE =====
  console.log('\n=== ACCOUNTANT PAGE ===');
  await page.goto(BASE + '/accountant.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  console.log('Accountant URL:', page.url());
  await scrollShot(page, '04_accountant');

  const accountantData = await page.evaluate(() => {
    const horizOF = document.body.scrollWidth > window.innerWidth;

    const sidebarSel = ['.sidebar', '.side-bar', '[class*="sidebar"]', 'aside'];
    let sidebarInfo = null;
    for (const s of sidebarSel) {
      const el = document.querySelector(s);
      if (el) {
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        sidebarInfo = {
          selector: s,
          display: st.display,
          position: st.position,
          transform: st.transform,
          w: Math.round(r.width),
          left: Math.round(r.left),
          visible: r.width > 0 && st.display !== 'none'
        };
        break;
      }
    }

    const tables = Array.from(document.querySelectorAll('table')).map(t => {
      const r = t.getBoundingClientRect();
      const wrapper = t.closest('[style*="overflow"], [class*="table-wrap"], [class*="responsive"]');
      return {
        w: Math.round(r.width),
        scrollW: t.scrollWidth,
        overflows: t.scrollWidth > window.innerWidth,
        hasWrapper: !!wrapper
      };
    });

    // Btn-flux on accountant
    const fluxBtns = Array.from(document.querySelectorAll('.btn-flux')).map(el => {
      const r = el.getBoundingClientRect();
      const st = window.getComputedStyle(el);
      return { text: el.textContent.trim().substring(0, 50), w: Math.round(r.width), h: Math.round(r.height), whiteSpace: st.whiteSpace };
    }).filter(b => b.w > 0);

    const overflowEls = Array.from(document.querySelectorAll('*')).filter(el => {
      const r = el.getBoundingClientRect();
      return r.right > window.innerWidth + 10;
    }).map(el => ({
      tag: el.tagName,
      class: el.className.substring(0, 60),
      right: Math.round(el.getBoundingClientRect().right)
    })).slice(0, 20);

    return { horizOF, bodyScrollWidth: document.body.scrollWidth, viewportW: window.innerWidth, sidebarInfo, tables, fluxBtns, overflowEls };
  });
  console.log('ACCOUNTANT DATA:', JSON.stringify(accountantData, null, 2));

  await browser.close();
  fs.writeFileSync(OUT + '/console_errors.json', JSON.stringify(consoleErrors, null, 2));
  console.log('\nDone. Screenshots at: ' + OUT);
})().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
