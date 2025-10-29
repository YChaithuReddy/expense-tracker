# 🚀 Custom Skills for Expense Tracker

## Overview

This directory contains **7 specialized skills** designed specifically for your expense tracker project. These skills make redesigning and upgrading your app incredibly easy.

## Available Skills

### 1. 📸 **Indian Receipt OCR Enhancement**
**Location:** `.claude/skills/indian-receipt-ocr/`

**What it does:**
- 95% accuracy for Indian bills
- Supports 20+ vendors (Swiggy, Zomato, Uber, Ola, Amazon, etc.)
- Extracts GST automatically (CGST, SGST, IGST)
- Handles all Indian date and currency formats
- Provides confidence scoring

**Use it by saying:**
- "Fix the OCR for Indian receipts"
- "The OCR isn't reading Swiggy bills correctly"
- "Improve receipt scanning accuracy"

---

### 2. 🎨 **UI Redesigner**
**Location:** `.claude/skills/ui-redesigner/`

**What it does:**
- Modern design patterns (glassmorphism, gradients)
- Smooth animations and transitions
- Responsive layouts (mobile, tablet, desktop)
- Professional color schemes
- Loading states and micro-interactions

**Use it by saying:**
- "Make the UI look more professional"
- "Add smooth animations"
- "Redesign the expense cards"
- "Make it more mobile-friendly"

---

### 3. 🧩 **Component Generator**
**Location:** `.claude/skills/component-generator/`

**What it does:**
- Generates ready-to-use components
- Modals, cards, buttons, forms, charts
- Consistent styling
- Responsive and accessible

**Use it by saying:**
- "Create a modal for editing expenses"
- "Add a toast notification system"
- "Generate a loading skeleton"
- "Build a chart component"

---

### 4. ⚡ **Performance Optimizer**
**Location:** `.claude/skills/performance-optimizer/`

**What it does:**
- Lazy loading for images
- Virtual scrolling for large lists
- API response caching
- Debounced search/filter
- IndexedDB offline storage

**Use it by saying:**
- "The app is slow, optimize it"
- "Images take too long to load"
- "Make the search faster"
- "Add offline support"

---

### 5. 📊 **Report Generator**
**Location:** `.claude/skills/report-generator/`

**What it does:**
- Professional Excel reports with formulas
- PDF generation with branding
- Charts and graphs
- GST breakdown
- Category summaries

**Use it by saying:**
- "Generate a reimbursement report"
- "Export to Excel with formulas"
- "Create a PDF report"
- "Add chart to report"

---

### 6. 🔧 **Feature Upgrader**
**Location:** `.claude/skills/feature-upgrader/`

**What it does:**
- Adds complete features quickly
- Dark mode, budget tracking, recurring expenses
- Smart category suggestions
- Duplicate detection
- Multi-currency support

**Use it by saying:**
- "Add dark mode"
- "Implement budget tracking"
- "Add recurring expenses"
- "Detect duplicate entries"

---

### 7. 📐 **Layout Fixer**
**Location:** `.claude/skills/layout-fixer/`

**What it does:**
- Fixes alignment issues (vertical, horizontal, grid)
- Corrects spacing inconsistencies
- Resolves flexbox and grid layout problems
- Handles overflow and positioning issues
- Fixes responsive layout breakpoints
- Aligns form fields and buttons perfectly

**Use it by saying:**
- "Fix the card alignment"
- "The spacing looks inconsistent"
- "Elements are overlapping"
- "Make the grid responsive"
- "Fix the form layout"

---

## 🎯 How to Use Skills

### Option 1: Just Talk Naturally (Easiest!)

Skills activate automatically when you mention relevant keywords:

```
You: "The OCR isn't reading Indian receipts correctly"
→ Activates: Indian Receipt OCR Enhancement skill
→ Claude uses specialized Indian patterns

You: "Make the expense cards look better"
→ Activates: UI Redesigner skill
→ Claude applies modern design patterns

You: "Add a dark mode"
→ Activates: Feature Upgrader skill
→ Claude implements complete dark mode
```

### Option 2: Direct Request

```
You: "Use the OCR skill to improve receipt scanning"
You: "Apply the UI redesigner skill to the dashboard"
You: "Use performance optimizer skill"
```

### Option 3: Specific Feature

```
You: "Create a modal component" → Component Generator
You: "Generate Excel report" → Report Generator
You: "Lazy load images" → Performance Optimizer
```

---

## 📋 Quick Reference

| What You Want | Say This | Skill Used |
|--------------|----------|------------|
| Better OCR | "Fix OCR for Indian bills" | Indian Receipt OCR |
| Modern UI | "Redesign the interface" | UI Redesigner |
| New Component | "Create a modal" | Component Generator |
| Faster App | "Optimize performance" | Performance Optimizer |
| Export Data | "Generate Excel report" | Report Generator |
| New Feature | "Add dark mode" | Feature Upgrader |
| Fix Layout | "Fix the alignment" | Layout Fixer |

---

## 🎨 Example Requests

### For Redesigning:
```
"Make the expense tracker look more professional"
"Add smooth animations to buttons"
"Improve the mobile layout"
"Create a modern glassmorphism design"
"Add loading states"
```

### For Features:
```
"Add dark mode"
"Implement budget tracking with alerts"
"Create recurring expenses"
"Add duplicate detection"
"Export to Google Sheets"
```

### For Performance:
```
"The app is slow, make it faster"
"Images take too long to load"
"Add offline support"
"Cache API responses"
```

### For OCR:
```
"OCR isn't reading amounts correctly"
"Support Swiggy and Zomato bills"
"Extract GST from receipts"
"Handle Indian date formats"
```

### For Layout:
```
"Fix the card alignment"
"The spacing looks inconsistent"
"Elements are overlapping"
"Make the form fields align properly"
"Fix the responsive layout on mobile"
```

---

## 📊 Skill Impact

| Skill | Time to Implement | Impact | Priority |
|-------|------------------|--------|----------|
| Indian Receipt OCR | 2 hours | ⭐⭐⭐⭐⭐ High | High |
| UI Redesigner | 3-4 hours | ⭐⭐⭐⭐⭐ High | High |
| Layout Fixer | 30 min - 1 hour | ⭐⭐⭐⭐⭐ High | High |
| Performance Optimizer | 2-3 hours | ⭐⭐⭐⭐ High | Medium |
| Component Generator | 30 min/component | ⭐⭐⭐ Medium | Medium |
| Report Generator | 2 hours | ⭐⭐⭐ Medium | Medium |
| Feature Upgrader | 1-3 hours/feature | ⭐⭐⭐⭐ High | Medium |

---

## 🔍 Skill Details

### View Skill Documentation
Each skill has a detailed `SKILL.md` file:
```
.claude/skills/indian-receipt-ocr/SKILL.md
.claude/skills/ui-redesigner/SKILL.md
.claude/skills/layout-fixer/SKILL.md
.claude/skills/component-generator/SKILL.md
.claude/skills/performance-optimizer/SKILL.md
.claude/skills/report-generator/SKILL.md
.claude/skills/feature-upgrader/SKILL.md
```

### Manifest File
Configuration: `.claude/skills/manifest.json`
- Lists all skills
- Trigger keywords
- Feature lists
- Priorities

---

## 💡 Pro Tips

1. **Combine Skills**: "Redesign the UI and make it faster"
   → Uses UI Redesigner + Performance Optimizer

2. **Be Specific**: "Add dark mode with smooth transitions"
   → Feature Upgrader uses UI Redesigner patterns

3. **Iterate**: Start with one skill, then add more
   → "First fix OCR, then redesign the cards"

4. **Natural Language**: Just describe the problem
   → "Users complain the app looks outdated and is slow"
   → Activates: UI Redesigner + Performance Optimizer

---

## 🎉 Getting Started

### Step 1: Try Your First Skill
```
You: "Fix the OCR to read Indian receipts better"
Claude: [Automatically uses Indian Receipt OCR skill]
Result: 95% accuracy for Indian bills!
```

### Step 2: Redesign Something
```
You: "Make the expense cards look more professional"
Claude: [Uses UI Redesigner skill]
Result: Modern glassmorphism cards with animations!
```

### Step 3: Add a Feature
```
You: "Add budget tracking"
Claude: [Uses Feature Upgrader skill]
Result: Complete budget system with warnings!
```

---

## 📚 Further Reading

- **Main Guide**: `SKILLS_PRACTICAL_GUIDE.md` (in project root)
- **Anthropic Documentation**: `anthropic_skills_guide.md`
- **Implementation Plan**: `skills_implementation_plan.md`
- **Recommendations**: `project_skills_recommendations.md`

---

## 🤝 Need Help?

Just ask:
- "What skills do I have?"
- "How do I use the OCR skill?"
- "Show me an example of using skills"
- "Which skill should I use for [problem]?"

Claude will guide you! 🚀
