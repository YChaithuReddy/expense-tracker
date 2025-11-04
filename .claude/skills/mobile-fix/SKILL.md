---
name: mobile-fix
description: Apply fixes for mobile view alignment and responsive design issues including padding, margins, flexbox layouts, button positioning, and media queries when the user asks to fix mobile layout problems or make the app mobile-responsive
---

# Mobile View Fix Skill

This skill applies fixes to mobile view alignment and layout issues in the expense tracker application.

## When to Use

Use this skill when the user asks to:
- Fix mobile view problems
- Make the app mobile-responsive
- Fix alignment on mobile
- Adjust layouts for small screens
- Fix buttons or elements on mobile
- Resolve mobile layout bugs

## What This Skill Does

Applies systematic fixes for mobile view issues including:

### 1. Layout Fixes
- Convert fixed widths to responsive percentages or viewport units
- Add or update mobile media queries
- Adjust flexbox/grid layouts for mobile
- Fix container overflow issues

### 2. Spacing Adjustments
- Reduce padding/margins for mobile screens
- Ensure adequate touch target sizes (minimum 44x44px)
- Add appropriate spacing between interactive elements
- Fix bottom spacing for modals and fixed elements

### 3. Typography
- Scale font sizes appropriately for mobile
- Ensure text is readable without zooming
- Adjust line heights for better mobile readability

### 4. Button & Form Elements
- Ensure buttons are properly sized for touch
- Fix button positioning (especially bottom-aligned buttons)
- Adjust input field sizes for mobile
- Ensure proper spacing around form elements

### 5. Modal & Overlay Fixes
- Make modals full-width on mobile
- Fix modal scrolling issues
- Ensure proper z-index stacking
- Add mobile-specific animations and transitions

## Mobile-First Approach

Apply fixes using a mobile-first methodology:

1. **Base Styles**: Start with mobile-friendly defaults
2. **Media Queries**: Use `min-width` for larger screens when possible
3. **Touch Targets**: Ensure all interactive elements are at least 44x44px
4. **Viewport Units**: Use `vw`, `vh` where appropriate
5. **Flexible Layouts**: Prefer flexbox/grid over fixed positioning

## Common Media Query Breakpoints

```css
/* Small mobile devices */
@media (max-width: 480px) { }

/* Tablets and large mobile */
@media (max-width: 768px) { }

/* Desktop and above */
@media (min-width: 769px) { }
```

## Testing Recommendations

After applying fixes, recommend testing on:
- iPhone SE (375px width)
- iPhone 12/13/14 (390px width)
- Samsung Galaxy (360px width)
- Tablet (768px width)

## Fix Patterns for This App

Common fix patterns used in this expense tracker:

### Modal Full Width
```css
@media (max-width: 768px) {
  .modal-panel {
    width: 100%;
    max-width: 100%;
  }
}
```

### Responsive Stats Grid
```css
@media (max-width: 480px) {
  .stats-container {
    display: flex;
    overflow-x: auto;
    gap: 8px;
  }
}
```

### Button Sizing
```css
@media (max-width: 480px) {
  .action-buttons {
    padding: 12px;
    gap: 8px;
  }
  .btn {
    padding: 10px 12px;
    font-size: 13px;
  }
}
```

## Output

After applying fixes:
1. List all files modified
2. Summarize changes made
3. Highlight specific line numbers changed
4. Provide testing instructions
5. Note any potential side effects to watch for
