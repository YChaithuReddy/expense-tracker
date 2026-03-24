---
description: Convert plain text request into detailed prompt with skills and agents
triggers:
  - enhance
  - clarify
  - detail my request
---

# Enhance Prompt Command

Transform your plain text request into a detailed, structured prompt with appropriate skills and agents.

## Usage

```
/enhance-prompt <your plain text request>
```

Or simply say:
- "enhance: redesign export button"
- "clarify: fix batch upload"
- "detail my request: add images to clear data"

## What This Does

The prompt enhancer agent will:

1. **Parse your request** to identify:
   - Action verbs (redesign, fix, add, debug)
   - Target components (buttons, modals, forms)
   - Feature areas (export, clear data, batch upload)

2. **Map to codebase** files and components:
   - UI → index.html, styles*.css
   - Logic → script.js
   - API → supabase-api.js
   - Build → build.js, capacitor config

3. **Recommend skills/agents:**
   - UI tasks → premium-ui-designer, ui-ux-designer
   - Bugs → debugging-specialist, codebase-decision-trees
   - Reviews → design-review

4. **Add project context:**
   - Recent changes (Clear Data redesign, batch fix)
   - Design patterns (glassmorphic, color-coded cards)
   - Known issues from memory files

5. **Enforce workflow:**
   - 7-step mandatory process
   - Task tracking requirements
   - Regression checklist

## Output Format

You'll receive a structured prompt with:
- 📋 Clear task description
- Category (UI/UX/Bug/Data/Build)
- Affected files list
- Step-by-step approach
- Skills/agents to use
- Workflow steps
- Task tracking plan
- Relevant context

## Examples

### Example 1: Vague Design Request

**You say:** "make buttons better"

**Enhanced output:**
```
📋 Enhanced Request

**Task:** Improve button design consistency
**Category:** UI/UX Enhancement

**Clarification Needed:**
- Which specific buttons?
- What aspects need improvement?
- Should they match new Clear Data modal style?

**Next Step:** Use AskUserQuestion to clarify requirements
```

### Example 2: Bug Report

**You say:** "export not working"

**Enhanced output:**
```
📋 Enhanced Request

**Task:** Debug Google Sheets export failure
**Category:** Bug Fix - Integration

**Affected Files:**
- frontend/google-sheets-service.js
- frontend/script.js (export button handler)

**Recommended Approach:**
1. Use debugging-specialist agent
2. Check console errors
3. Verify Supabase data format
4. Test export with sample data

**Skills/Agents:** debugging-specialist, codebase-decision-trees
```

### Example 3: Feature Request

**You say:** "add delete button to images"

**Enhanced output:**
```
📋 Enhanced Request

**Task:** Add delete functionality to saved images
**Category:** Feature Enhancement

**Affected Files:**
- frontend/script.js (image card rendering, delete handler)
- frontend/supabase-api.js (delete image API call)
- frontend/styles_images.css (delete button styles)

**Recommended Approach:**
1. Add delete button to each image card
2. Show confirmation modal before delete
3. Update stats after deletion
4. Match Clear Data modal button style

**Skills/Agents:** premium-ui-designer (button design)

**Task Tracking:**
- Task 1: Add delete button UI
- Task 2: Implement delete API call
- Task 3: Update stats display
- Task 4: Test and validate
```

## When to Use

Use this command when:
- Your request is brief or vague
- You're not sure which files/components are affected
- You want to ensure the right skills/agents are used
- You need a structured plan before implementation

## Agent Details

This command uses the **prompt-enhancer** agent which:
- Understands the Expense Tracker codebase structure
- Knows all available skills and agents
- Enforces the 7-step workflow
- References memory files for context
- Ensures task tracking is used

---

**Pro Tip:** After getting the enhanced prompt, review it and say "proceed" to start implementation, or refine the requirements if needed.
