# Expense Tracker

A full-stack expense tracking application with OCR bill scanning, UPI payment integration, and Google Sheets export.

## Quick Commands

```bash
# Build Android APK
cd frontend && node build.js && npx cap sync android

# Run backend locally
cd backend && npm run dev

# Deploy web
git push origin main  # Auto-deploys to Vercel
```

## Architecture

| Layer | Technology |
|-------|------------|
| **Frontend** | Vanilla JavaScript + CSS |
| **Mobile** | Capacitor (Android/iOS) |
| **Backend** | Node.js + Express |
| **Database** | MongoDB (Mongoose) + Supabase |
| **Auth** | Supabase Auth (Google OAuth + Email) |
| **OCR** | Tesseract.js |
| **Storage** | Cloudinary (images) |
| **Deployment** | Vercel (web), Android APK |

## Key Files

### Frontend
- `frontend/index.html` - Main app UI
- `frontend/script.js` - Core app logic (~5000 lines)
- `frontend/upi-import.js` - UPI app launcher (Google Pay, PhonePe, Paytm)
- `frontend/supabase-api.js` - Auth & API calls
- `frontend/supabase-auth.js` - Auth state management
- `frontend/google-sheets-service.js` - Google Sheets export
- `frontend/deep-link-handler.js` - OAuth deep link handling

### Backend
- `backend/server.js` - Express server entry
- `backend/services/ocr.js` - Receipt OCR processing
- `backend/routes/expenses.js` - Expense CRUD API
- `backend/routes/whatsapp.js` - WhatsApp integration

### Android
- `frontend/android/` - Capacitor Android project
- `frontend/android/app/src/main/java/.../MainActivity.java` - Native Java bridge
- `frontend/capacitor.config.ts` - Capacitor configuration
- `frontend/build.js` - Build script for Capacitor

## Important Patterns

### Building for Mobile
Always run these after frontend changes:
```bash
cd frontend
node build.js        # Copies files to www/
npx cap sync android # Syncs to Android project
```
Then rebuild in Android Studio.

### OAuth Flow (Mobile)
- Uses custom URL scheme: `expensetracker://auth`
- Redirect URL must be added to Supabase dashboard
- Deep link handler processes OAuth tokens

### UPI Integration
- Uses Android JavaScript bridge (`AppLauncher`)
- Opens UPI apps via package name
- Falls back to Play Store if app not installed

## Environment Variables

### Backend (.env)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret
- `CLOUDINARY_*` - Cloudinary credentials

### Frontend (Supabase)
- Configured in `supabase-client.js`
- Uses public anon key (safe to expose)

## Common Issues

### "Mobile App Required" popup
- The APK's JavaScript bridge isn't connecting
- Check MainActivity.java has AppLauncher interface
- Ensure build.js and cap sync were run

### Google OAuth not returning to app
- Check `expensetracker://auth` is in Supabase redirect URLs
- Verify AndroidManifest.xml has intent filter

### Multiple Google Sheets created
- Race condition in initialization
- Fixed with locking in google-sheets-service.js

## Visual Development & Testing (Playwright MCP)

### Quick Visual Check

**IMMEDIATELY after implementing any front-end change:**

1. **Identify what changed** - Review the modified components/pages
2. **Navigate to affected pages** - Use `mcp__playwright__browser_navigate` to visit each changed view
3. **Verify the implementation** - Ensure the change fulfills the user's request
4. **Capture evidence** - Take screenshot at desktop viewport (1440px)
5. **Check for errors** - Run `mcp__playwright__browser_console_messages`

### Playwright MCP Commands

```javascript
// Navigation & Screenshots
mcp__playwright__browser_navigate(url)        // Navigate to page
mcp__playwright__browser_take_screenshot()    // Capture visual evidence
mcp__playwright__browser_resize(width, height) // Test responsiveness
mcp__playwright__browser_snapshot()           // Accessibility snapshot

// Interaction Testing
mcp__playwright__browser_click(ref)           // Test clicks
mcp__playwright__browser_type(ref, text)      // Test input
mcp__playwright__browser_hover(ref)           // Test hover states
mcp__playwright__browser_fill_form(fields)    // Fill multiple fields

// Validation
mcp__playwright__browser_console_messages()   // Check for JS errors
mcp__playwright__browser_network_requests()   // Check API calls
mcp__playwright__browser_wait_for(text)       // Wait for content
```

### When to Use Visual Testing

**Use Quick Visual Check for:**
- Every front-end change (CSS, HTML, JS UI)
- After implementing new components
- When fixing visual bugs
- Before committing UI changes

**Skip Visual Testing for:**
- Backend-only changes (API, database)
- Configuration file updates
- Non-visual utility functions

### Design Compliance Checklist

When implementing UI features, verify:
- [ ] **Visual Hierarchy**: Clear focus flow, appropriate spacing
- [ ] **Responsiveness**: Mobile (375px), tablet (768px), desktop (1440px)
- [ ] **Accessibility**: Keyboard navigable, proper contrast
- [ ] **Error Handling**: Clear error states, helpful messages
- [ ] **Performance**: Fast load, smooth animations (150-300ms)

### Test URLs

- **Production**: https://expense-tracker-delta-ashy.vercel.app
- **Login**: https://expense-tracker-delta-ashy.vercel.app/login.html
- **Signup**: https://expense-tracker-delta-ashy.vercel.app/signup.html

### Comprehensive Design Review

For significant UI changes, use the design review agent:

```bash
/design-review
```

The design review agent will:
- Test all interactive states and user flows
- Verify responsiveness (desktop/tablet/mobile)
- Check accessibility (WCAG 2.1 AA)
- Validate visual polish and consistency
- Provide categorized feedback (Blockers/High/Medium/Nitpicks)

### Additional Context Files

- **Design Principles**: `context/design-principles.md` - UI standards checklist
- **Design Review Agent**: `.claude/agents/design-review-agent.md`
- **Premium UI Designer**: `.claude/agents/premium-ui-designer.md`
- **Debugging Specialist**: `.claude/agents/debugging-specialist.md`
- **Slash Commands**: `.claude/commands/design-review.md`

## Active Hooks (7 total - full lifecycle coverage)

| Hook | Event | What It Does |
|------|-------|-------------|
| `session-start-context.sh` | SessionStart | Loads fresh context: memory files, rules, checklist reminders |
| `workflow-enforcer.sh` | UserPromptSubmit | Reminds 7-step workflow + task list. Detects bug/fix/feature/CSS context. |
| `block-env-edits.sh` | PreToolUse (Edit/Write) | Blocks edits to .env files |
| `pre-commit-gate.sh` | PreToolUse (Bash) | Quality gate before git commit: console.log, !important, async, build sync |
| `auto-cap-sync.sh` | PostToolUse (Edit/Write) | Auto-syncs Capacitor after frontend file changes |
| `pre-compact-save.sh` | PreCompact | Saves unsaved findings to memory before context compression |
| `stop-learning-reminder.sh` | Stop | Reminds to invoke /learn-and-remember if code was changed |

## Smart Debugging Resources

| Resource | Purpose |
|----------|---------|
| `memory/anti-patterns.md` | 16 documented anti-patterns. CHECK BEFORE FIXING. |
| `memory/file-map.md` | File dependency + blast radius map. CHECK BEFORE EDITING. |
| `memory/workflow.md` | Full 7-step workflow with task list template. |
| `memory/debugging-log.md` | Running log of all bugs fixed. CHECK FOR PATTERNS. |
| `memory/regression-checklist.md` | Post-change verification. RUN AFTER EVERY FIX. |
| `codebase-decision-trees` skill | Decision trees for CSS, async, modal, build, Supabase, OAuth. |

## Mandatory Development Workflow

**Every task MUST follow this 7-step process. No exceptions.**

1. **Problem Understanding** - Restate, clarify what/when/where/expected. If unclear, STOP and ask.
2. **Issue Classification** - Categorize (UI/CSS/Logic/State/Backend/API/Async/Data/Build/Security). Explain why.
3. **Activate Agents** - Only relevant ones: UI/UX, CSS & Layout, Structure, State & Data, Async & Perf, Backend, Integration, Architecture, Responsive.
4. **Root Cause Analysis** - REQUIRED before any fix. Exact cause with specific code/line. If uncertain, STOP.
5. **Fix Strategy** - Global vs local, why correct, why safe, what unchanged. No code yet.
6. **Implementation** - Minimal, targeted. Follow existing architecture. Preserve behavior.
7. **Validation & Learning** - Verify fix, no regressions, record learnings with `/learn-and-remember`.

### Mandatory Task List (NON-NEGOTIABLE)
**Every multi-step change MUST use TaskCreate/TaskUpdate to track progress.**

- **Before work**: Break into atomic tasks (`TaskCreate` with `subject`, `description`, `activeForm`)
- **Starting a task**: `TaskUpdate` → status `in_progress`
- **Finishing a task**: `TaskUpdate` → status `completed`
- **After all tasks**: Final task to invoke `/learn-and-remember` → update all MD files
- **Dependencies**: Use `addBlockedBy`/`addBlocks` when order matters

This gives the user real-time visibility, prevents skipped steps, and ensures learnings are always recorded.

### Non-Negotiable Rules
- Never assume backend failure without evidence
- Never suggest refresh/reload as solution
- Never hide bugs with CSS tricks
- Never create nested scroll containers unless intentional
- Prefer single source of truth
- If unsure → STOP and ask
- **ALWAYS use task list for multi-step work**

### Learning Protocol
After every fix/change, record (as a tracked task):
- What broke and why (root cause)
- What pattern caused it (reusable lesson)
- How to prevent it (future-proofing rule)
- Update: MEMORY.md, workflow.md, CLAUDE.md as appropriate

Full workflow details: see `memory/workflow.md`

## Custom Skills

| Skill | Description |
|-------|-------------|
| `/learn-and-remember` | **Auto-record learnings** after code changes into CLAUDE.md and memory |
| `/codebase-decision-trees` | **Decision trees** for debugging CSS, async, modal, build, Supabase, OAuth |
| `/mobile-build` | Build and sync Capacitor Android APK |
| `/mobile-debug` | Debug mobile view alignment issues |
| `/mobile-fix` | Apply fixes for mobile responsive design |
| `/indian-receipt-ocr` | OCR optimization for Indian receipts |
| `/ui-redesigner` | Redesign UI components |
| `/layout-fixer` | Fix layout and alignment issues |
| `/performance-optimizer` | Optimize app performance |
| `/report-generator` | Generate expense reports |
