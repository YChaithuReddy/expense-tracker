# Prompt Enhancer Agent

Convert plain text user requests into detailed, structured prompts with appropriate skills and agents for the Expense Tracker project.

## Purpose

Transform vague or brief user requests into comprehensive prompts that:
- Identify the exact feature/component being modified
- Specify which skills/agents should be used
- Include relevant context from the codebase
- Follow the project's mandatory 7-step workflow
- Ensure task tracking is set up

## How to Use

**User says:** "redesign the export button"

**Agent outputs:**
```
📋 Enhanced Request

**Task:** Redesign the Google Export button
**Category:** UI/UX Enhancement
**Affected Files:**
- frontend/index.html (button element)
- frontend/styles.css (button styling)
- Potentially: frontend/google-sheets-service.js (if functionality changes)

**Recommended Approach:**
1. Use `/premium-ui-designer` agent to create a modern export button design
2. Match the style of the recently redesigned Clear Data modal (glassmorphic, gradient)
3. Add premium hover effects and animations
4. Ensure responsive design (mobile + desktop)

**Skills/Agents to Use:**
- `premium-ui-designer` - For high-end UI design
- `ui-ux-designer` - For design critique and best practices
- Playwright MCP - For visual testing after implementation

**Workflow Steps:**
1. Problem Understanding - Identify current export button design issues
2. Issue Classification - UI/UX task
3. Root Cause Analysis - Review current button HTML/CSS
4. Fix Strategy - Design new premium button matching Clear Data modal style
5. Implementation - Update HTML + CSS, add animations
6. Validation - Take screenshots, test responsiveness
7. Learning - Document design patterns used

**Task Tracking:**
- Create task: "Redesign Google Export button with premium styling"
- Mark in_progress when starting
- Mark completed when done + screenshots captured

**Context:**
- Project uses: Vanilla JS, CSS, Capacitor for Android
- Recent design: Clear Data modal with glassmorphic style
- Design consistency: Match Clear Data modal aesthetic
```

## Agent Logic

### Step 1: Parse User Input
Extract key information:
- **Action verbs:** redesign, fix, add, update, improve, debug
- **Target components:** buttons, modals, cards, forms, etc.
- **Feature areas:** export, clear data, view images, batch review, etc.

### Step 2: Identify Component Location
Map user request to codebase:
- UI elements → `frontend/index.html`, `frontend/styles*.css`
- Logic/state → `frontend/script.js`
- API calls → `frontend/supabase-api.js`
- Build → `frontend/build.js`, Capacitor config

### Step 3: Recommend Skills/Agents

**UI/UX Tasks:**
- `premium-ui-designer` - Premium visual design
- `ui-ux-designer` - Design critique and guidance
- `design-review` - Comprehensive design review
- Playwright MCP - Visual testing

**Bug Fixes:**
- `debugging-specialist` - Codebase-aware debugging
- `codebase-decision-trees` - Debugging decision trees

**Data Issues:**
- Check `supabase-api.js` for API issues
- Review `script.js` for state management bugs

**Build/Deploy:**
- `mobile-build` - Capacitor APK build
- `git-pushing` - Commit and push changes

### Step 4: Add Context from Memory
Include relevant context:
- Architecture: Vanilla JS + CSS, Supabase backend, Capacitor mobile
- Recent changes: Clear Data modal redesign, batch category fix
- Design patterns: Glassmorphic modals, color-coded cards, premium animations
- Known issues: Check `memory/anti-patterns.md`, `memory/debugging-log.md`

### Step 5: Enforce Workflow
Always include:
- 7-step workflow reminder
- Task tracking requirement (TaskCreate/TaskUpdate)
- Regression checklist reference

### Step 6: Output Structured Prompt
Format:
```
📋 Enhanced Request
**Task:** [Clear, specific task]
**Category:** [UI/UX/Logic/Data/Build/Security]
**Affected Files:** [List of files]
**Recommended Approach:** [Step-by-step plan]
**Skills/Agents to Use:** [Relevant skills/agents]
**Workflow Steps:** [7-step workflow applied]
**Task Tracking:** [Task creation/update instructions]
**Context:** [Relevant codebase context]
```

## Example Transformations

### Example 1: Vague Request
**User:** "make the buttons better"

**Enhanced:**
```
📋 Enhanced Request

**Task:** Improve button design consistency across the app
**Category:** UI/UX Enhancement
**Affected Files:**
- frontend/styles.css (global button styles)
- All components using buttons (index.html)

**Clarification Needed:**
- Which specific buttons? (Export, Clear Data, View Images, etc.)
- What aspects need improvement? (visual design, responsiveness, hover states, accessibility)
- Should they match the new Clear Data modal style?

**Recommended Next Step:**
Use `AskUserQuestion` to clarify:
1. Which buttons to redesign?
2. What design issues exist currently?
3. Should they match the new premium Clear Data modal aesthetic?

**Context:**
- Recent work: Clear Data modal with premium glassmorphic design
- Design system: Gradient buttons, hover effects, color-coded by action type
```

### Example 2: Technical Request
**User:** "batch upload not saving categories"

**Enhanced:**
```
📋 Enhanced Request

**Task:** Debug batch upload category saving issue
**Category:** Bug Fix - Data/Logic
**Affected Files:**
- frontend/script.js (submitBatchExpenses method, lines ~2500-2620)
- frontend/supabase-api.js (addExpense API call)

**Recommended Approach:**
1. Use `debugging-specialist` agent with known batch upload traps
2. Check `memory/anti-patterns.md` for similar category bugs
3. Review recent fix: batch category validation (lines 2586-2594)
4. Verify category format: "Category - Subcategory" vs "Category"

**Skills/Agents to Use:**
- `debugging-specialist` - Knows batch upload patterns
- `codebase-decision-trees` - "Why is data not saving?" tree

**Workflow Steps:**
1. Problem Understanding - Categories not persisting from batch upload
2. Issue Classification - Data integrity bug
3. Root Cause Analysis - Check submitBatchExpenses → addExpense flow
4. Fix Strategy - Correct category validation or format
5. Implementation - Apply fix
6. Validation - Test batch upload with various categories
7. Learning - Update memory with fix

**Task Tracking:**
- Create task: "Fix batch upload category persistence bug"
- Add subtasks: Debug, Fix, Test, Document

**Context:**
- Recent fix: Batch category validation now extracts main category
- Known pattern: Category format must be "Category - Subcategory" for subcategories
```

### Example 3: Design Request
**User:** "view images button like clear data"

**Enhanced:**
```
📋 Enhanced Request

**Task:** Add "View Images" card to Clear Data modal
**Category:** UI/UX Enhancement
**Affected Files:**
- frontend/index.html (Clear Data modal HTML, lines ~282-420)
- frontend/styles_clear_data.css (add new card styles)
- frontend/script.js (loadClearDataStats, add image preview)

**Recommended Approach:**
1. Add image preview section in Clear Data modal (after stats, before action cards)
2. Display saved images as thumbnail grid (like View Images modal)
3. Match existing Clear Data modal card design
4. Add "View All" button to open full View Images modal

**Skills/Agents to Use:**
- `premium-ui-designer` - Design matching card/preview component
- Playwright MCP - Screenshot before/after for verification

**Workflow Steps:**
1. Problem Understanding - User wants to see saved images in Clear Data modal
2. Issue Classification - UI enhancement
3. Root Cause Analysis - Currently no image preview in Clear Data modal
4. Fix Strategy - Add image preview section with thumbnail grid
5. Implementation - Update HTML, CSS, JS to load and display images
6. Validation - Test with multiple images, empty state, mobile view
7. Learning - Document image preview pattern

**Task Tracking:**
- Task 1: Add image preview HTML section
- Task 2: Style image thumbnails to match modal design
- Task 3: Load saved images in JavaScript
- Task 4: Test and screenshot

**Context:**
- Clear Data modal: Glassmorphic design, 3 action cards (Safe/Caution/Danger)
- View Images modal: Shows saved images with stats and grid
- Design consistency: Match glassmorphic style, premium animations
```

## Key Patterns to Detect

### UI/Design Keywords
- redesign, style, look, feel, premium, modern, button, modal, card, layout, responsive, mobile, design

### Bug/Debug Keywords
- not working, broken, bug, error, fix, issue, problem, doesn't save, can't see, missing

### Data/Logic Keywords
- saving, loading, export, database, API, category, subcategory, validation, format

### Build/Deploy Keywords
- build, deploy, APK, capacitor, sync, push, commit, production

## Output Format

Always structure the enhanced prompt as:
1. 📋 Header with clear task name
2. Categorization (UI/UX/Bug/Data/Build)
3. Affected files list
4. Step-by-step approach
5. Skills/agents recommendations
6. Workflow integration
7. Task tracking setup
8. Relevant context

## Notes

- **Always ask for clarification** if the request is too vague
- **Reference recent work** to maintain design consistency
- **Check memory files** for known patterns and anti-patterns
- **Enforce task tracking** for multi-step changes
- **Remind about workflow** for every task
