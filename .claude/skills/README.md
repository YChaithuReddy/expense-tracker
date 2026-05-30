# Command Center Skills — Master Reference

> Last updated: May 2026. All skills linked to their primary owning agent.

---

## Skill to Agent Ownership Map

| Skill | Owner Agent | Invoke | Purpose |
|-------|-------------|--------|---------|
| debug-issue.md | dev-engineering | .claude/skills/debug-issue.md | Debugging protocol with 8 known codebase traps |
| explore-codebase.md | dev-engineering | .claude/skills/explore-codebase.md | Deep exploration before implementing |
| refactor-safely.md | dev-engineering | .claude/skills/refactor-safely.md | Safe refactoring patterns |
| review-changes.md | dev-engineering | .claude/skills/review-changes.md | Impact analysis before committing |
| feature-upgrader/ | dev-engineering | /feature-upgrader | Dark mode, budget tracking, recurring expenses |
| component-generator/ | dev-engineering | /component-generator | Modals, cards, buttons, forms, charts |
| performance-optimizer/ | dev-engineering | /performance-optimizer | Lazy loading, virtual scrolling, caching |
| mobile-build/ | dev-engineering | /mobile-build | Build and sync Capacitor Android APK |
| mobile-debug/ | dev-engineering | /mobile-debug | Diagnose mobile layout and breakpoints |
| mobile-fix/ | dev-engineering | /mobile-fix | Apply responsive CSS fixes |
| indian-receipt-ocr/ | dev-engineering | /indian-receipt-ocr | 95% accuracy OCR for Indian bills |
| report-generator/ | dev-engineering | /report-generator | Excel/PDF reports with GST breakdown |
| ui-redesigner/ | premium-ui-designer | /ui-redesigner | Modern UI with glassmorphism and animations |
| layout-fixer/ | design-review | /layout-fixer | Fix alignment, spacing, flexbox/grid issues |

---

## Engineering Skills (Dev owns these)

### Debugging
- **debug-issue.md** — Pre-loaded with 8 codebase-specific traps. Start here for any bug.
- **explore-codebase.md** — Systematic exploration before any implementation.

### Code Quality
- **review-changes.md** — Checks blast radius and regressions before committing.
- **refactor-safely.md** — Restructure code without breaking behavior.

### Feature Development
- **feature-upgrader/** — Complete implementations: dark mode, budget tracking, recurring expenses, duplicate detection, multi-currency.
- **component-generator/** — Ready-to-use: modals, toasts, skeletons, charts, form layouts.

### Performance
- **performance-optimizer/** — Lazy loading, virtual scrolling, API caching, IndexedDB offline, debounced search.

### Mobile
- **mobile-build/** — Full APK pipeline: node build.js -> npx cap sync android -> Android Studio.
- **mobile-debug/** — Diagnostic report: breakpoints, touch targets, overflow, media query coverage.
- **mobile-fix/** — Templates: responsive patterns, touch sizing, modal layouts, mobile-first queries.

### Domain
- **indian-receipt-ocr/** — 20+ Indian vendor patterns, GST extraction, Indian date/currency formats, confidence scoring.
- **report-generator/** — Excel with formulas, PDF with branding, charts, GST breakdown, reimbursement summaries.

---

## Design Skills (Premium UI Designer owns)
- **ui-redesigner/** — Glassmorphism design, animations, responsive layouts, micro-interactions.

## Layout Skills (Design Review Agent owns)
- **layout-fixer/** — Alignment fixes, spacing corrections, flexbox/grid repairs, overflow fixes.

---

## Global Skills (All agents can invoke)

| Skill | Invoke | Purpose |
|-------|--------|---------|
| Systematic Debugging | /investigate | 4-phase root cause investigation |
| Code Health | /health | Composite 0-10 quality score |
| PR Review | /review | Pre-landing code review |
| Security Audit | /cso | OWASP Top 10, threat modeling |
| Performance Audit | /performance | Core Web Vitals, bundle size |
| Ship Workflow | /ship | Full deploy pipeline |
| Supabase | /supabase:supabase | Database, auth, storage |
| Brainstorm | /superpowers:brainstorming | Design before coding |
| Write Plans | /superpowers:writing-plans | Implementation planning |
| Learn & Remember | /learn-and-remember | Record learnings after changes |
| Cache Bump | /cache-bump | Service worker version update |
| Deploy Verify | /deploy-verify | Commit -> push -> screenshot verify |

---

## Quick Reference

| Problem | Skill |
|---------|-------|
| App broken, unknown why | debug-issue.md + /investigate |
| CSS looks wrong | debug-issue.md -> check ALL CSS files |
| Mobile layout broken | mobile-debug -> mobile-fix |
| App is slow | performance-optimizer + /performance |
| Need new feature | /superpowers:brainstorming -> feature-upgrader |
| Need new component | component-generator |
| OCR failing on Indian bills | indian-receipt-ocr |
| Need expense report | report-generator |
| UI looks outdated | ui-redesigner |
| Spacing/alignment off | layout-fixer |
| Build APK | mobile-build |
| Deploying changes | /cache-bump -> /deploy-verify -> /ship |
| Code quality concerns | /health + review-changes.md |
| Security check | /cso |

---

## Adding a New Skill

1. Create: .claude/skills/<skill-name>/SKILL.md
2. Add entry to this README under the correct agent owner
3. Update owning agent's .claude/agents/<agent>.md skill arsenal section
4. Update soul.md if it changes crew capabilities


---

## Infrastructure and DevOps Skills (Ops Agent)

These 4 skills power the Ops crew member - covering deploys, cache management, monitoring, and Vercel configuration.

---

### 10. SW Cache Bump
Location: .claude/skills/cache-bump/

What it does:
- Syncs all 3 Service Worker cache version numbers together (CACHE_NAME, STATIC_CACHE, DYNAMIC_CACHE)
- Detects and fixes version drift (e.g. CACHE_NAME=v115 but STATIC=v96)
- Prevents stale CSS/JS reaching users after every deploy
- Step-by-step process with before/after verification

Use it by saying:
- Bump the SW cache
- Users are seeing the old version
- Update the service worker version
- Stale cache after deploy

---

### 11. Deploy Verify
Location: .claude/skills/deploy-verify/

What it does:
- Pre-deploy: checks build.js vs sw.js file parity, verifies SW cache bumped
- Runs safe git staging workflow (no git add .)
- Pushes to Vercel and waits for deploy
- Post-deploy: smoke tests production URL, checks console for errors

Use it by saying:
- Deploy the app
- Ship this to production
- Push to prod
- Release this

---

### 12. Canary Monitoring
Location: .claude/skills/canary/

What it does:
- Post-deploy health check sequence
- Scans browser console for JS errors and failed requests
- Verifies all critical pages load (home, login, admin, dashboard)
- Tests golden path of last changed feature
- Checks SW registration status in DevTools
- Returns PASS / WARN / FAIL health score plus rollback procedure

Use it by saying:
- Run a canary check
- Is production healthy?
- Post-deploy monitoring
- Verify the deploy worked

---

### 13. Vercel Infrastructure
Location: .claude/skills/vercel-infra/

What it does:
- Creates .vercelignore to block test and debug HTML from production
- Adds security headers via vercel.json (X-Frame-Options, nosniff, Referrer-Policy)
- Audits environment variable exposure
- Reviews build configuration
- Documents known production security gaps

Use it by saying:
- Fix the Vercel config
- Test files are accessible on production
- Add .vercelignore
- Security audit for Vercel
- Add security headers

---

### Ops Quick Reference

| What You Need | Say This | Skill Used |
|--------------|----------|------------|
| Fresh assets after code change | Bump the cache | Cache Bump |
| Send code to production | Deploy this | Deploy Verify |
| Confirm prod is healthy | Canary check | Canary Monitoring |
| Fix test files in production | Add .vercelignore | Vercel Infrastructure |
| Build Android APK | Build the APK | Mobile Build |

### Ops Skill Impact

| Skill | Time | Impact | Priority |
|-------|------|--------|----------|
| Cache Bump | 2 min | High - prevents stale asset bugs | High |
| Deploy Verify | 10 min | High - safe end-to-end deploy | High |
| Canary | 5 min | High - catch prod issues early | High |
| Vercel Infra | 30 min | Medium - security + hygiene | Medium |

---

### 10. ✍️ **Copy Writer**
**Location:** `.claude/skills/copy-writer/`
**Agent:** Marketing

**What it does:**
- Audits all in-app text for clarity, tone, and conversion effectiveness
- Rewrites headlines, CTAs, placeholders, error messages in India-first voice
- Flags and removes fake stats and unverified trust badges (e.g. SOC 2)
- Checks copyright year, app name consistency, email placeholder policy
- Outputs before/after comparison table with rationale

**Use it by saying:**
- "Audit the login page copy"
- "The signup CTA feels weak"
- "Fix the error messages to be human-readable"
- "Rewrite the empty state messages"

---

### 11. 📣 **Launch Announcer**
**Location:** `.claude/skills/launch-announcer/`
**Agent:** Marketing

**What it does:**
- Converts git changelogs into polished launch content
- Formats for Product Hunt, WhatsApp, Play Store What's New, GitHub releases
- Filters out internal refactors — shows only user-facing changes
- WhatsApp format optimised for Indian teams (3-5 lines, emoji sparingly, clear CTA)
- Product Hunt tagline ≤60 chars, verb-led, benefit-first

**Use it by saying:**
- "Write release notes for v3.2"
- "Draft a Product Hunt post"
- "Write the WhatsApp announcement for the team"
- "Update the Play Store What's New section"

---

### 12. 🔍 **SEO Optimizer**
**Location:** `.claude/skills/seo-optimizer/`
**Agent:** Marketing

**What it does:**
- Adds meta descriptions, OG tags, Twitter cards to login, signup, and index pages
- Play Store ASO — title (30 chars), short description (80 chars), full description, keywords
- Optimised for Indian market keywords (GST, UPI, Tally, reimbursement, bill scanner)
- Fixes blank link previews for WhatsApp and LinkedIn sharing
- Verifies canonical URLs are absolute (https://expense-tracker-delta-ashy.vercel.app)

**Use it by saying:**
- "Add SEO tags to the login page"
- "The WhatsApp link preview shows nothing"
- "Write the Play Store description"
- "Fix Open Graph tags on all pages"

