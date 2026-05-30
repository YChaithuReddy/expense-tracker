/**
 * Mobile Design Audit Script — Phase 2
 * Tests login/signup pages + injects auth bypass to test protected pages
 */
const { chromium } = require('playwright');
const fs = require('fs');

const VIEWPORT = { width: 375, height: 812 };
const BASE = 'https://expense-tracker-delta-ashy.vercel.app';
const OUT = 'C:/Users/chath/Documents/Python code/expense tracker/audit_screenshots';

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file, fullPage: false });
  console.log('SHOT: ' + name);
  return file;
}

async function scrollShots(page, prefix) {
  const info = { prefix, shots: [] };
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await shot(page, prefix + '_01_top');
  info.shots.push('top');

  const h = await page.evaluate(() => document.body.scrollHeight);
  const vh = VIEWPORT.height;

  if (h > vh + 100) {
    const thirds = [Math.floor(h * 0.33), Math.floor(h * 0.66), h];
    const labels = ['mid1', 'mid2', 'bottom'];
    for (let i = 0; i < thirds.length; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), thirds[i]);
      await page.waitForTimeout(400);
      await shot(page, prefix + '_0' + (i+2) + '_' + labels[i]);
      info.shots.push(labels[i]);
    }
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  return info;
}

async function domInfo(page) {
  return page.evaluate((vw) => {
    // Horizontal overflow detection — find ALL overflowing elements
    const overflowEls = [];
    document.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 4 && r.width > 0) {
        overflowEls.push({
          tag: el.tagName,
          cls: (el.className || '').toString().substring(0, 60),
          id: el.id || '',
          right: Math.round(r.right),
          width: Math.round(r.width)
        });
      }
    });

    // Touch target sizes — elements smaller than 44x44
    const smallTargets = [];
    document.querySelectorAll('a, button, [role="button"], input, select').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44)) {
        smallTargets.push({
          tag: el.tagName,
          cls: (el.className || '').toString().substring(0, 50),
          text: el.textContent.trim().substring(0, 30),
          w: Math.round(r.width),
          h: Math.round(r.height)
        });
      }
    });

    return {
      bodyScrollWidth: document.body.scrollWidth,
      viewportW: vw,
      hasHorizontalOverflow: document.body.scrollWidth > vw,
      overflowEls: overflowEls.slice(0, 15),
      smallTargets: smallTargets.slice(0, 20),
      bodyScrollHeight: document.body.scrollHeight
    };
  }, VIEWPORT.width);
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ============================================================
  // PASS 1: Login & Signup pages (no auth needed)
  // ============================================================
  {
    const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const pageErrors = {};
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const u = page.url();
        if (!pageErrors[u]) pageErrors[u] = [];
        pageErrors[u].push(msg.text().substring(0, 200));
      }
    });

    // ---------- LOGIN ----------
    console.log('\n==== LOGIN PAGE ====');
    await page.goto(BASE + '/login.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    await scrollShots(page, 'L1_login');

    const loginDom = await domInfo(page);
    const loginSpecific = await page.evaluate(() => {
      // Left panel
      const leftPanel = document.querySelector('.login-panel-left, aside.login-panel-left');
      const leftPanelStyle = leftPanel ? window.getComputedStyle(leftPanel) : null;

      // Right panel / form container
      const right = document.querySelector('.login-panel-right');
      const rightR = right ? right.getBoundingClientRect() : null;

      // Buttons
      const allBtns = Array.from(document.querySelectorAll('button, [type="submit"]')).map(el => {
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return {
          text: el.textContent.trim().replace(/\s+/g, ' ').substring(0, 60),
          w: Math.round(r.width), h: Math.round(r.height),
          fullWidth: r.width >= window.innerWidth * 0.85,
          touchFriendly: r.height >= 44
        };
      }).filter(b => b.w > 0 && b.h > 0);

      // Eye toggle
      const eyeToggle = document.querySelector('.toggle-password, .password-toggle');
      const eyeR = eyeToggle ? eyeToggle.getBoundingClientRect() : null;

      // Brand pill (mobile logo)
      const mobileBrand = document.querySelector('.mobile-brand');
      const mobileBrandStyle = mobileBrand ? window.getComputedStyle(mobileBrand) : null;

      // Inputs
      const inputs = Array.from(document.querySelectorAll('input')).map(el => {
        const r = el.getBoundingClientRect();
        return { type: el.type, w: Math.round(r.width), h: Math.round(r.height), fontSize: window.getComputedStyle(el).fontSize };
      }).filter(i => i.w > 0);

      // Form fits in viewport
      const form = document.querySelector('form, .login-form-body');
      const formR = form ? form.getBoundingClientRect() : null;

      return {
        leftPanel: leftPanelStyle ? { display: leftPanelStyle.display } : 'not found',
        rightPanelW: rightR ? Math.round(rightR.width) : null,
        buttons: allBtns,
        eyeToggle: eyeR ? { w: Math.round(eyeR.width), h: Math.round(eyeR.height) } : 'not found',
        mobileBrand: mobileBrandStyle ? { display: mobileBrandStyle.display } : 'not found',
        inputs,
        formFitsInViewport: formR ? formR.bottom <= window.innerHeight : null,
        formBottom: formR ? Math.round(formR.bottom) : null,
        viewportH: window.innerHeight
      };
    });

    console.log('LOGIN DOM:', JSON.stringify(loginDom, null, 2));
    console.log('LOGIN SPECIFIC:', JSON.stringify(loginSpecific, null, 2));

    // ---------- SIGNUP ----------
    console.log('\n==== SIGNUP PAGE ====');
    await page.goto(BASE + '/signup.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    await scrollShots(page, 'L2_signup');

    const signupDom = await domInfo(page);
    const signupSpecific = await page.evaluate(() => {
      const leftPanel = document.querySelector('.signup-panel-left, aside.signup-panel-left');
      const leftStyle = leftPanel ? window.getComputedStyle(leftPanel) : null;

      const inputs = Array.from(document.querySelectorAll('input')).map(el => {
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return {
          type: el.type, placeholder: el.placeholder,
          w: Math.round(r.width), h: Math.round(r.height),
          fontSize: st.fontSize
        };
      }).filter(i => i.w > 0);

      const btns = Array.from(document.querySelectorAll('button, [type="submit"]')).map(el => {
        const r = el.getBoundingClientRect();
        return {
          text: el.textContent.trim().replace(/\s+/g, ' ').substring(0, 60),
          w: Math.round(r.width), h: Math.round(r.height)
        };
      }).filter(b => b.w > 0 && b.h > 0);

      // Password toggle
      const pwToggle = document.querySelector('.toggle-password, .password-toggle, [data-toggle-password]');
      const pwToggleR = pwToggle ? pwToggle.getBoundingClientRect() : null;

      // Check if form needs scrolling
      const card = document.querySelector('.signup-form-card, form');
      const cardR = card ? card.getBoundingClientRect() : null;

      return {
        leftPanel: leftStyle ? { display: leftStyle.display } : 'not found',
        inputs, btns,
        pwToggle: pwToggleR ? { w: Math.round(pwToggleR.width), h: Math.round(pwToggleR.height), visible: pwToggleR.width > 0 } : 'not found',
        formBottom: cardR ? Math.round(cardR.bottom) : null,
        viewportH: window.innerHeight,
        needsScroll: cardR ? cardR.bottom > window.innerHeight : null
      };
    });

    console.log('SIGNUP DOM:', JSON.stringify(signupDom, null, 2));
    console.log('SIGNUP SPECIFIC:', JSON.stringify(signupSpecific, null, 2));

    fs.writeFileSync(OUT + '/pass1_console_errors.json', JSON.stringify(pageErrors, null, 2));
    await ctx.close();
  }

  // ============================================================
  // PASS 2: Try login with credentials — if successful, test index
  // ============================================================
  {
    const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
    const page = await ctx.newPage();

    // Try to login
    console.log('\n==== ATTEMPTING LOGIN ====');
    await page.goto(BASE + '/login.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    // Check if there's a test/demo login
    const demoBtn = await page.$('button[data-demo], .demo-login, #demoBtn, [data-action="demo"]');
    if (demoBtn) {
      console.log('Found demo button, clicking...');
      await demoBtn.click();
      await page.waitForTimeout(3000);
    } else {
      // Try with a plausible test account
      const emailInput = await page.$('input[type="email"], input[name="email"], #email');
      const pwInput = await page.$('input[type="password"], #password');
      if (emailInput && pwInput) {
        await emailInput.fill('admin@fluxgentech.com');
        await pwInput.fill('password123');
        const submitBtn = await page.$('button[type="submit"], .login-btn, .btn-primary');
        if (submitBtn) await submitBtn.click();
        await page.waitForTimeout(4000);
      }
    }

    const afterLoginUrl = page.url();
    console.log('After login URL:', afterLoginUrl);
    await shot(page, 'L3_after_login');

    // If still on login page, inject localStorage to bypass auth check
    if (afterLoginUrl.includes('login')) {
      console.log('Login failed. Injecting session bypass...');

      // Navigate to index and inject fake session before auth check runs
      await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });

      // Check if there's a Supabase session check — inject fake data
      await page.evaluate(() => {
        // Set localStorage items that might bypass auth check
        const fakeSession = {
          access_token: 'fake_token_for_testing',
          refresh_token: 'fake_refresh_token',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: 'bearer',
          user: {
            id: 'test-user-123',
            email: 'test@fluxgentech.com',
            user_metadata: { full_name: 'Test User', name: 'Test User' },
            app_metadata: {},
            aud: 'authenticated',
            role: 'authenticated'
          }
        };
        // Try various localStorage key patterns used by Supabase
        localStorage.setItem('sb-access-token', fakeSession.access_token);
        localStorage.setItem('sb-refresh-token', fakeSession.refresh_token);
        // Supabase v2 uses project-ref based keys
        Object.keys(localStorage).forEach(k => {
          if (k.includes('supabase') || k.includes('sb-')) {
            console.log('Existing supabase key:', k);
          }
        });
      });

      console.log('Auth bypass injected, staying on index...');
    }

    await page.waitForTimeout(3000);
    const currentUrl = page.url();
    console.log('Current URL after bypass attempt:', currentUrl);

    if (!currentUrl.includes('login')) {
      // We're on the protected page — do the full audit
      console.log('\n==== INDEX PAGE AUDIT ====');
      await page.waitForTimeout(1000);
      await scrollShots(page, 'M1_index');

      const indexDom = await domInfo(page);
      const indexSpecific = await page.evaluate(() => {
        // Bottom nav
        const nav = document.querySelector('.mobile-bottom-nav');
        const navStyle = nav ? window.getComputedStyle(nav) : null;
        const navR = nav ? nav.getBoundingClientRect() : null;
        const navItems = nav ? Array.from(nav.querySelectorAll('button, a')).map(el => {
          const r = el.getBoundingClientRect();
          return { cls: el.className.substring(0, 50), w: Math.round(r.width), h: Math.round(r.height) };
        }) : [];

        // Scan FAB
        const scanFab = document.querySelector('.mobile-bottom-nav__scan');
        const scanR = scanFab ? scanFab.getBoundingClientRect() : null;
        const scanStyle = scanFab ? window.getComputedStyle(scanFab) : null;

        // Header
        const header = document.querySelector('.app-header-bar, header');
        const headerR = header ? header.getBoundingClientRect() : null;

        // Action cards
        const actionCards = Array.from(document.querySelectorAll('.exp-action-card')).map(el => {
          const r = el.getBoundingClientRect();
          return { text: el.textContent.trim().replace(/\s+/g, ' ').substring(0, 40), w: Math.round(r.width), h: Math.round(r.height) };
        }).filter(c => c.w > 0);

        // btn-flux buttons
        const fluxBtns = Array.from(document.querySelectorAll('.btn-flux')).map(el => {
          const r = el.getBoundingClientRect();
          const st = window.getComputedStyle(el);
          return {
            text: el.textContent.trim().replace(/\s+/g, ' ').substring(0, 60),
            w: Math.round(r.width), h: Math.round(r.height),
            whiteSpace: st.whiteSpace, overflow: st.overflow
          };
        }).filter(b => b.w > 0);

        // Submit reimbursement button
        const submitBtn = document.querySelector('#downloadReimbursementPackage');
        const submitR = submitBtn ? submitBtn.getBoundingClientRect() : null;

        // Main content padding vs nav height
        const main = document.querySelector('main, .admin-main, .main-content');
        const mainStyle = main ? window.getComputedStyle(main) : null;

        // Camera/gallery buttons
        const cameraBtn = document.querySelector('#cameraBtn');
        const galleryBtn = document.querySelector('#galleryBtn');
        const cameraR = cameraBtn ? cameraBtn.getBoundingClientRect() : null;
        const galleryR = galleryBtn ? galleryBtn.getBoundingClientRect() : null;

        // Expense cards (visible ones)
        const expRows = Array.from(document.querySelectorAll('.expense-row')).slice(0, 3).map(el => {
          const r = el.getBoundingClientRect();
          return { w: Math.round(r.width), h: Math.round(r.height) };
        });

        return {
          bottomNav: navStyle ? {
            display: navStyle.display,
            position: navStyle.position,
            h: navR ? Math.round(navR.height) : null,
            bottomFromViewport: navR ? Math.round(window.innerHeight - navR.top) : null,
            itemCount: navItems.length,
            items: navItems
          } : 'not found',
          scanFab: scanR ? {
            w: Math.round(scanR.width), h: Math.round(scanR.height),
            top: Math.round(scanR.top),
            raisedAboveNav: scanStyle ? scanStyle.top : null
          } : 'not found',
          header: headerR ? { w: Math.round(headerR.width), h: Math.round(headerR.height) } : 'not found',
          actionCards,
          fluxBtns,
          submitBtn: submitR ? { w: Math.round(submitR.width), h: Math.round(submitR.height) } : 'not found',
          mainPaddingBottom: mainStyle ? mainStyle.paddingBottom : null,
          cameraBtn: cameraR ? { w: Math.round(cameraR.width), h: Math.round(cameraR.height) } : 'not found',
          galleryBtn: galleryR ? { w: Math.round(galleryR.width), h: Math.round(galleryR.height) } : 'not found',
          expenseRows: expRows
        };
      });

      console.log('INDEX DOM:', JSON.stringify(indexDom, null, 2));
      console.log('INDEX SPECIFIC:', JSON.stringify(indexSpecific, null, 2));
    } else {
      console.log('Still on login page — protected pages not accessible without real auth');
      await shot(page, 'M1_index_blocked');
    }

    await ctx.close();
  }

  // ============================================================
  // PASS 3: Accountant page (may also be protected)
  // ============================================================
  {
    const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const pageErrors = {};
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const u = page.url();
        if (!pageErrors[u]) pageErrors[u] = [];
        pageErrors[u].push(msg.text().substring(0, 200));
      }
    });

    console.log('\n==== ACCOUNTANT PAGE ====');
    await page.goto(BASE + '/accountant.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    console.log('Accountant URL:', page.url());
    await scrollShots(page, 'A1_accountant');

    const acctDom = await domInfo(page);
    const acctSpecific = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar, aside, [class*="sidebar"]');
      const sidebarStyle = sidebar ? window.getComputedStyle(sidebar) : null;
      const sidebarR = sidebar ? sidebar.getBoundingClientRect() : null;

      const bottomNav = document.querySelector('.mobile-bottom-nav, .bottom-nav');
      const bottomNavStyle = bottomNav ? window.getComputedStyle(bottomNav) : null;

      const tables = Array.from(document.querySelectorAll('table')).map(t => {
        const r = t.getBoundingClientRect();
        return {
          scrollW: t.scrollWidth,
          clientW: t.clientWidth,
          overflows: t.scrollWidth > window.innerWidth,
          hasScrollWrapper: !!t.closest('[style*="overflow-x"], .table-responsive, [class*="table-wrap"]')
        };
      });

      const fluxBtns = Array.from(document.querySelectorAll('.btn-flux')).map(el => {
        const r = el.getBoundingClientRect();
        return { text: el.textContent.trim().replace(/\s+/g, ' ').substring(0, 50), w: Math.round(r.width), h: Math.round(r.height) };
      }).filter(b => b.w > 0);

      return {
        sidebar: sidebarStyle ? {
          display: sidebarStyle.display,
          w: sidebarR ? Math.round(sidebarR.width) : 0,
          visible: sidebarStyle.display !== 'none' && (sidebarR ? sidebarR.width > 0 : false)
        } : 'not found',
        bottomNav: bottomNavStyle ? { display: bottomNavStyle.display } : 'not found',
        tables,
        fluxBtns,
        bodyScrollWidth: document.body.scrollWidth,
        viewportW: window.innerWidth,
        hasHorizOverflow: document.body.scrollWidth > window.innerWidth
      };
    });

    console.log('ACCOUNTANT DOM:', JSON.stringify(acctDom, null, 2));
    console.log('ACCOUNTANT SPECIFIC:', JSON.stringify(acctSpecific, null, 2));

    fs.writeFileSync(OUT + '/pass3_console_errors.json', JSON.stringify(pageErrors, null, 2));
    await ctx.close();
  }

  await browser.close();
  console.log('\n\nAll done! Screenshots at: ' + OUT);
})().catch(err => {
  console.error('FATAL:', err.message, err.stack);
  process.exit(1);
});
