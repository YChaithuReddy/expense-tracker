# Layout Fixer Skill

## Purpose
Quickly diagnose and fix UI alignment, spacing, and layout issues in your expense tracker. This skill specializes in resolving common CSS layout problems that make UIs look unprofessional or broken.

## When to Activate
- User says: "fix layout", "alignment is off", "spacing looks bad", "elements overlapping", "not aligned"
- Words like: "misaligned", "broken layout", "UI issues", "positioning wrong", "doesn't fit"
- Requests: "fix this page layout", "make it look cleaner", "align properly", "fix spacing"
- Screenshot shows: misaligned elements, inconsistent spacing, overflow issues, awkward layouts

## Project Context
**Your Expense Tracker:**
- Frontend: Vanilla JavaScript with CSS Grid/Flexbox
- Files: `frontend/styles.css`, `frontend/index.html`, `frontend/script.js`
- Current layouts: Grid-based batch gallery, flexbox forms, modal overlays
- Theme: Dark theme with glassmorphism effects

## Common Layout Issues & Fixes

### 1. Alignment Problems

#### Issue: Elements Not Vertically Aligned
```css
/* ❌ Bad */
.detail-row {
    display: flex;
}

/* ✅ Fixed */
.detail-row {
    display: flex;
    align-items: center;  /* Vertical centering */
    gap: 12px;           /* Consistent spacing */
}
```

#### Issue: Text/Labels Not Aligned
```css
/* ❌ Bad */
.label {
    display: inline-block;
}

/* ✅ Fixed - Using Grid for Perfect Alignment */
.detail-row {
    display: grid;
    grid-template-columns: 85px 1fr;  /* Fixed label width */
    align-items: center;
    gap: 12px;
}
```

#### Issue: Cards Not Aligned in Grid
```css
/* ❌ Bad */
.gallery {
    display: grid;
    grid-template-columns: 1fr 1fr;
}

/* ✅ Fixed - Auto-fit with min-max */
.gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(480px, 1fr));
    gap: 24px;
    align-items: start;  /* Prevents stretching */
}
```

### 2. Spacing Issues

#### Issue: Inconsistent Margins/Padding
```css
/* ❌ Bad - Random spacing */
.card { padding: 15px; margin: 13px; }
.form { padding: 18px; margin: 9px; }

/* ✅ Fixed - Use spacing system */
:root {
    --spacing-xs: 4px;
    --spacing-sm: 8px;
    --spacing-md: 12px;
    --spacing-lg: 16px;
    --spacing-xl: 20px;
    --spacing-2xl: 24px;
}

.card { padding: var(--spacing-xl); margin: var(--spacing-md); }
.form { padding: var(--spacing-xl); margin: var(--spacing-md); }
```

#### Issue: Elements Too Cramped/Sparse
```css
/* ✅ Proper spacing hierarchy */
.card-details {
    display: flex;
    flex-direction: column;
    gap: 14px;  /* Space between rows */
}

.detail-row {
    display: grid;
    grid-template-columns: 85px 1fr;
    gap: 12px;  /* Space between label and input */
}
```

### 3. Overflow Problems

#### Issue: Content Overflowing Container
```css
/* ❌ Bad */
.modal-content {
    height: 100%;
}

/* ✅ Fixed */
.modal-content {
    max-height: 90vh;
    overflow-y: auto;
    overflow-x: hidden;
}
```

#### Issue: Long Text Breaking Layout
```css
/* ✅ Prevent text overflow */
.vendor-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
}

/* Or allow wrapping */
.description {
    word-break: break-word;
    overflow-wrap: break-word;
}
```

#### Issue: Images Breaking Layout
```css
/* ✅ Responsive images */
.card-image {
    width: 100%;
    height: 280px;
    overflow: hidden;
}

.card-image img {
    width: 100%;
    height: 100%;
    object-fit: contain;  /* or 'cover' for filling */
}
```

### 4. Flexbox Issues

#### Issue: Flex Items Not Sizing Properly
```css
/* ❌ Bad */
.input-group {
    display: flex;
}

/* ✅ Fixed */
.input-group {
    display: flex;
    align-items: center;
    gap: 12px;
}

.input-group label {
    flex-shrink: 0;      /* Label stays fixed size */
    min-width: 80px;
}

.input-group input {
    flex: 1;             /* Input takes remaining space */
}
```

#### Issue: Flex Container Not Full Width
```css
/* ✅ Ensure proper flex container */
.form-row {
    display: flex;
    width: 100%;
    box-sizing: border-box;
}
```

### 5. Grid Layout Issues

#### Issue: Grid Items Wrong Size
```css
/* ❌ Bad - Fixed columns */
.gallery {
    display: grid;
    grid-template-columns: 400px 400px;
}

/* ✅ Fixed - Responsive with min-max */
.gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(480px, 1fr));
    gap: 24px;
}
```

#### Issue: Grid Items Not Aligned
```css
/* ✅ Proper grid alignment */
.gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(480px, 1fr));
    gap: 24px;
    align-items: start;        /* Vertical alignment */
    justify-items: stretch;    /* Horizontal alignment */
}
```

### 6. Positioning Problems

#### Issue: Absolute Elements Overlapping
```css
/* ✅ Proper z-index hierarchy */
.card-checkbox {
    position: absolute;
    top: 16px;
    left: 16px;
    z-index: 10;              /* Above image */
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    padding: 4px;
    border-radius: 6px;
}

.card-confidence {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 10;              /* Same level as checkbox */
}
```

#### Issue: Modal Not Centered
```css
/* ✅ Perfect modal centering */
.modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;      /* Vertical center */
    justify-content: center;  /* Horizontal center */
    z-index: 1000;
}

.modal-content {
    max-width: 90%;
    max-height: 90vh;
}
```

### 7. Responsive Layout Issues

#### Issue: Layout Breaks on Mobile
```css
/* ✅ Mobile-first responsive */
.batch-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(480px, 1fr));
    gap: 24px;
}

/* Single column on tablets and below */
@media (max-width: 1024px) {
    .batch-gallery {
        grid-template-columns: 1fr;
        gap: 20px;
    }
}

@media (max-width: 768px) {
    .batch-gallery {
        gap: 16px;
        padding: 12px;
    }
}
```

#### Issue: Horizontal Scroll on Mobile
```css
/* ✅ Prevent horizontal overflow */
* {
    box-sizing: border-box;
}

body {
    overflow-x: hidden;
}

.container {
    max-width: 100%;
    padding: 16px;
    box-sizing: border-box;
}
```

### 8. Form Layout Issues

#### Issue: Form Fields Not Aligned
```css
/* ✅ Perfect form field alignment */
.form-group {
    display: grid;
    grid-template-columns: 100px 1fr;  /* Label | Input */
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
}

.form-label {
    text-align: right;
    font-weight: 600;
}

.form-input {
    width: 100%;
}

/* Mobile: Stack vertically */
@media (max-width: 768px) {
    .form-group {
        grid-template-columns: 1fr;
        gap: 8px;
    }

    .form-label {
        text-align: left;
    }
}
```

### 9. Dropdown & Select Issues

#### Issue: Dropdown Width Problems
```css
/* ✅ Proper select sizing */
.inline-input select,
select.inline-input {
    flex: 1;
    width: 100%;
    min-width: 0;          /* Prevents flex overflow */
    padding: 10px 36px 10px 14px;  /* Space for arrow */
    cursor: pointer;
    appearance: none;      /* Remove default arrow */
    background-image: url("data:image/svg+xml,...");
    background-repeat: no-repeat;
    background-position: right 12px center;
}
```

### 10. Button Alignment Issues

#### Issue: Buttons Not Aligned
```css
/* ✅ Aligned button groups */
.button-group {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 20px;
}

.button-group-left {
    display: flex;
    gap: 12px;
}

.button-group-right {
    display: flex;
    gap: 12px;
    margin-left: auto;
}

/* Mobile: Stack vertically */
@media (max-width: 768px) {
    .button-group {
        flex-direction: column;
        align-items: stretch;
    }

    .button-group button {
        width: 100%;
    }
}
```

## Layout Debugging Checklist

When fixing layout issues, check these in order:

### 1. Box Model
- [ ] All elements use `box-sizing: border-box`
- [ ] Padding doesn't break width calculations
- [ ] Margins aren't collapsing unexpectedly

### 2. Flex/Grid
- [ ] Parent has `display: flex` or `display: grid`
- [ ] Flex items have proper `flex` values
- [ ] Grid has proper `grid-template-columns/rows`
- [ ] Gap is used instead of margins between items

### 3. Positioning
- [ ] Absolute elements have positioned parent
- [ ] Z-index hierarchy makes sense
- [ ] Fixed elements don't overlap content

### 4. Overflow
- [ ] Containers have proper overflow handling
- [ ] Content doesn't break out of bounds
- [ ] Scrolling works where needed

### 5. Responsive
- [ ] Media queries at proper breakpoints
- [ ] Mobile layout works (320px - 768px)
- [ ] Tablet layout works (769px - 1024px)
- [ ] Desktop layout works (1025px+)

### 6. Spacing
- [ ] Consistent spacing system (4px, 8px, 12px, 16px, 20px, 24px)
- [ ] No random values (13px, 17px, etc.)
- [ ] Gap used instead of margin in flex/grid

## Quick Fixes

### Fix Misaligned Cards
```css
.batch-card {
    display: flex;
    flex-direction: column;  /* Stack content vertically */
}

.card-content {
    flex: 1;                 /* Take remaining space */
    display: flex;
    flex-direction: column;
}

.card-details {
    flex: 1;                 /* Push button to bottom */
}

.btn-delete {
    margin-top: auto;        /* Stick to bottom */
}
```

### Fix Inconsistent Input Sizes
```css
.inline-input {
    width: 100%;
    min-width: 0;            /* Allow flex shrinking */
    padding: 10px 14px;
    box-sizing: border-box;
}
```

### Fix Grid Not Filling Space
```css
.batch-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(480px, 1fr));
    gap: 24px;
    width: 100%;             /* Fill parent */
    box-sizing: border-box;
}
```

## Testing Layout Fixes

After fixing, test on:
- [ ] Chrome DevTools (Responsive mode)
- [ ] Mobile: 375px (iPhone), 360px (Android)
- [ ] Tablet: 768px (iPad), 1024px
- [ ] Desktop: 1280px, 1920px
- [ ] With long content (long vendor names, amounts)
- [ ] With short content
- [ ] With 1 item vs 20 items

## Pro Tips

1. **Use Flexbox for 1D layouts** (rows or columns)
2. **Use Grid for 2D layouts** (rows AND columns)
3. **Always use gap** instead of margins in flex/grid
4. **Use CSS Grid for form alignment** (perfect column alignment)
5. **Mobile first** - design for mobile, enhance for desktop
6. **Test with real content** - long names, large numbers
7. **Use dev tools** - Chrome Grid/Flexbox inspector is amazing

## Common Commands

Tell me:
- "Fix the card alignment"
- "The spacing looks inconsistent"
- "Elements are overlapping"
- "Make the grid responsive"
- "Fix the form layout"
- "Inputs are misaligned"
- "The modal isn't centered"

## Example Fixes

### Before: Misaligned Form
```html
<div class="detail-row">
    <span>Vendor:</span>
    <input type="text">
</div>
```

```css
.detail-row {
    display: flex;
}
```

### After: Perfectly Aligned Form
```html
<div class="detail-row">
    <label class="label">Vendor:</label>
    <input type="text" class="inline-input">
</div>
```

```css
.detail-row {
    display: grid;
    grid-template-columns: 85px 1fr;
    align-items: center;
    gap: 12px;
}

.label {
    font-weight: 600;
    color: var(--text-secondary);
}

.inline-input {
    width: 100%;
    padding: 10px 14px;
}
```

## Integration with Other Skills

- **UI Redesigner**: After fixing layout, enhance with animations
- **Component Generator**: Generate components with proper layout
- **Performance Optimizer**: Ensure layout changes don't hurt performance

## Troubleshooting

### Element not visible?
1. Check `display` property
2. Check `overflow: hidden` on parent
3. Check z-index
4. Check if parent has height

### Layout shifting on load?
1. Set explicit dimensions on images
2. Use `aspect-ratio` property
3. Reserve space for dynamic content

### Flexbox not working?
1. Check parent has `display: flex`
2. Check flex-direction
3. Check if width is constrained
4. Try using `flex: 1` on items

### Grid not responsive?
1. Use `minmax()` with `auto-fill`
2. Add media queries for breakpoints
3. Check grid-template-columns syntax
