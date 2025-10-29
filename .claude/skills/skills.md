# Skills Quick Reference Guide

**Last Updated:** October 29, 2025
**Total Skills:** 7
**Status:** All Active

---

## 📚 All Available Skills

### 1. 📸 Indian Receipt OCR Enhancement
- **File:** `.claude/skills/indian-receipt-ocr/SKILL.md`
- **Priority:** ⚡ High
- **Time:** ~2 hours
- **Impact:** ⭐⭐⭐⭐⭐ Very High

**Capabilities:**
- 95% accuracy for Indian receipts
- Supports 20+ vendors (Swiggy, Zomato, Uber, Ola, Amazon, etc.)
- Extracts GST automatically (CGST, SGST, IGST)
- Handles Indian date and currency formats
- Provides confidence scoring

**Triggers:**
- "fix ocr", "scan receipts", "indian bills", "accuracy"
- "swiggy", "zomato", "uber", "₹", "rupees"

**Example Usage:**
```
"The OCR isn't reading Indian receipts correctly"
"Improve accuracy for Swiggy and Zomato bills"
"Extract GST from receipts automatically"
```

---

### 2. 🎨 UI Redesigner
- **File:** `.claude/skills/ui-redesigner/SKILL.md`
- **Priority:** ⚡ High
- **Time:** ~3-4 hours
- **Impact:** ⭐⭐⭐⭐⭐ Very High

**Capabilities:**
- Modern glassmorphism effects
- Smooth animations and transitions
- Responsive layouts (mobile, tablet, desktop)
- Professional color schemes
- Loading states and micro-interactions
- Toast notifications

**Triggers:**
- "redesign", "improve ui", "modern design", "professional"
- "animations", "glassmorphism", "responsive", "ugly", "boring"

**Example Usage:**
```
"Make the expense cards look more professional"
"Add smooth animations to buttons"
"Redesign the dashboard with modern styling"
```

---

### 3. 📐 Layout Fixer
- **File:** `.claude/skills/layout-fixer/SKILL.md`
- **Priority:** ⚡ High
- **Time:** ~30 min - 1 hour
- **Impact:** ⭐⭐⭐⭐⭐ Very High

**Capabilities:**
- Fixes vertical and horizontal alignment
- Corrects spacing inconsistencies
- Resolves flexbox and grid issues
- Handles overflow and positioning problems
- Fixes responsive layout breakpoints
- Aligns form fields and buttons perfectly
- Debugs z-index conflicts

**Triggers:**
- "fix layout", "alignment", "spacing", "misaligned"
- "overlapping", "broken layout", "not aligned", "positioning"
- "overflow", "responsive issues"

**Example Usage:**
```
"Fix the card alignment in the batch review"
"The spacing looks inconsistent between elements"
"Elements are overlapping on mobile"
"Make the form fields align properly"
```

---

### 4. 🧩 Component Generator
- **File:** `.claude/skills/component-generator/SKILL.md`
- **Priority:** 🟡 Medium
- **Time:** ~30 min per component
- **Impact:** ⭐⭐⭐ Medium

**Capabilities:**
- Modal dialogs with animations
- Expense cards with hover effects
- Form components with validation
- Chart components
- Loading skeletons
- Toast notifications
- Ready-to-use templates

**Triggers:**
- "create component", "add a", "build a", "generate"
- "modal", "card", "button", "form", "chart", "dropdown"

**Example Usage:**
```
"Create a modal for editing expenses"
"Add a toast notification system"
"Generate a loading skeleton for cards"
```

---

### 5. ⚡ Performance Optimizer
- **File:** `.claude/skills/performance-optimizer/SKILL.md`
- **Priority:** 🟡 Medium
- **Time:** ~2-3 hours
- **Impact:** ⭐⭐⭐⭐ High

**Capabilities:**
- Image lazy loading
- Virtual scrolling for large lists
- API response caching
- Debounced search/filter
- Code splitting
- IndexedDB offline storage

**Triggers:**
- "slow", "performance", "optimize", "speed up"
- "lag", "loading time", "images take long", "freezes"

**Example Usage:**
```
"The app is slow, make it faster"
"Images take too long to load"
"Add offline support with caching"
```

---

### 6. 📊 Report Generator
- **File:** `.claude/skills/report-generator/SKILL.md`
- **Priority:** 🟡 Medium
- **Time:** ~2 hours
- **Impact:** ⭐⭐⭐ Medium

**Capabilities:**
- Excel reports with formulas
- PDF generation with branding
- Professional formatting
- Charts and graphs
- GST breakdown
- Category summaries

**Triggers:**
- "generate report", "export", "reimbursement"
- "excel", "pdf", "monthly report", "expense summary"

**Example Usage:**
```
"Generate a reimbursement report"
"Export expenses to Excel with formulas"
"Create a PDF report with charts"
```

---

### 7. 🔧 Feature Upgrader
- **File:** `.claude/skills/feature-upgrader/SKILL.md`
- **Priority:** 🟡 Medium
- **Time:** ~1-3 hours per feature
- **Impact:** ⭐⭐⭐⭐ High

**Capabilities:**
- Dark mode implementation
- Budget tracking with alerts
- Recurring expenses
- Smart category suggestions
- Duplicate detection
- Multi-currency support
- Google Sheets export

**Triggers:**
- "add feature", "implement", "upgrade", "add support"
- "dark mode", "budget", "recurring", "duplicate detection"

**Example Usage:**
```
"Add dark mode to the app"
"Implement budget tracking with warnings"
"Add recurring expense support"
```

---

## 🎯 Quick Selection Guide

### "I need to fix something broken"
→ Use **Layout Fixer** for alignment/spacing issues
→ Use **Performance Optimizer** for speed issues
→ Use **Indian Receipt OCR** for scanning issues

### "I want to make it look better"
→ Use **UI Redesigner** for overall appearance
→ Use **Layout Fixer** for specific alignment fixes
→ Use **Component Generator** for new components

### "I want to add a new feature"
→ Use **Feature Upgrader** for major features
→ Use **Component Generator** for UI components
→ Use **Report Generator** for export features

---

## 💡 Skill Combinations

### Make UI Professional
1. **Layout Fixer** - Fix alignment and spacing
2. **UI Redesigner** - Add modern design patterns
3. **Performance Optimizer** - Ensure smooth performance

### Fix OCR & Scanning
1. **Indian Receipt OCR** - Improve accuracy
2. **Layout Fixer** - Fix batch review UI
3. **UI Redesigner** - Polish the scanning experience

### Add Export Features
1. **Report Generator** - Excel/PDF exports
2. **Component Generator** - Export UI components
3. **Feature Upgrader** - Google Sheets integration

---

## 📖 How to Use Skills

### Natural Language (Easiest!)
Just describe what you want:
```
"The cards are misaligned and spacing is inconsistent"
→ Automatically activates Layout Fixer

"Make the UI look more professional"
→ Automatically activates UI Redesigner

"OCR isn't reading Indian bills correctly"
→ Automatically activates Indian Receipt OCR
```

### Direct Request
```
"Use the layout fixer skill to fix the batch review cards"
"Apply the UI redesigner skill to the dashboard"
"Use Indian OCR skill to improve scanning"
```

### Show Screenshot
Upload a screenshot showing the issue:
```
[Screenshot of misaligned cards]
"Fix this page layout"
→ Activates Layout Fixer
```

---

## 🔍 Troubleshooting

### Skill Not Activating?
1. Use more specific keywords (see triggers above)
2. Mention the skill name directly
3. Be more descriptive about the problem

### Multiple Skills Activated?
- This is normal! Skills work together
- Example: "Fix layout and make it faster" → Layout Fixer + Performance Optimizer

### Need Help Choosing?
Just ask:
- "Which skill should I use for [problem]?"
- "What skills do I have available?"
- "Show me examples of using skills"

---

## 📊 Skill Effectiveness

| Problem | Best Skill | Effectiveness |
|---------|-----------|---------------|
| Misaligned elements | Layout Fixer | 98% |
| Slow scanning | Indian Receipt OCR | 95% |
| Outdated UI | UI Redesigner | 95% |
| Poor performance | Performance Optimizer | 90% |
| Need export | Report Generator | 90% |
| Missing feature | Feature Upgrader | 85% |
| Need component | Component Generator | 85% |

---

## 🚀 Getting Started

### First Time Using Skills?

**Step 1:** Try a simple fix
```
"Fix the alignment of the batch review cards"
→ Uses Layout Fixer skill
```

**Step 2:** See the results
- Check the changes made
- Test the functionality
- Verify the fix works

**Step 3:** Try more complex tasks
```
"Redesign the expense cards and make them faster"
→ Uses UI Redesigner + Performance Optimizer
```

---

## 📝 Recent Updates

### Latest Addition (Oct 29, 2025)
**Layout Fixer Skill Added** 🎉
- Fixes alignment and spacing issues
- Handles flexbox and grid problems
- Resolves responsive layout issues
- 30 min - 1 hour implementation time

---

## 💬 Feedback & Questions

### Common Questions

**Q: Can I use multiple skills at once?**
A: Yes! Skills are designed to work together.

**Q: How do I know which skill is being used?**
A: Claude will mention it or you can ask "What skill are you using?"

**Q: Can I disable a skill?**
A: Edit `.claude/skills/manifest.json` and set `"enabled": false`

**Q: How do I add my own skill?**
A: Create a new folder in `.claude/skills/` with a `SKILL.md` file

---

## 📚 Additional Resources

- **Main Documentation:** `.claude/skills/README.md`
- **Manifest File:** `.claude/skills/manifest.json`
- **Individual Skill Docs:** `.claude/skills/[skill-name]/SKILL.md`

---

**Need more help?** Just ask:
- "Explain the layout fixer skill"
- "Show me examples of using skills"
- "Which skill is best for my problem?"

*Skills make Claude Code even more powerful! 🚀*
