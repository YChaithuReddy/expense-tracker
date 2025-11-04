# Common Mobile Layout Issues

## 1. Fixed Width Elements
**Problem**: Elements with fixed pixel widths don't scale on mobile
```css
/* Bad */
.container { width: 480px; }

/* Good */
.container { width: 100%; max-width: 480px; }
```

## 2. Missing Touch Targets
**Problem**: Buttons/links too small for touch interaction
- Minimum size: 44x44px (Apple HIG)
- Recommended: 48x48px (Material Design)

## 3. Horizontal Overflow
**Problem**: Content extends beyond viewport
```css
/* Fix */
.container {
  max-width: 100%;
  overflow-x: hidden;
}
```

## 4. Text Not Readable
**Problem**: Font sizes too small on mobile
```css
/* Minimum for body text */
body { font-size: 16px; }
```

## 5. Inadequate Spacing
**Problem**: Elements too close together for touch
```css
/* Good spacing for mobile */
.button-group {
  gap: 12px; /* minimum 8px between touch targets */
}
```

## 6. Modal Issues
Common modal problems on mobile:
- Not full width
- Can't scroll content
- Bottom buttons hidden by keyboard
- Close button too small

## 7. Flexbox Wrapping
**Problem**: Flex items don't wrap on small screens
```css
/* Fix */
.flex-container {
  flex-wrap: wrap;
  gap: 12px;
}
```

## 8. Z-Index Stacking
**Problem**: Elements overlap incorrectly
- Backdrop: z-index: 9998
- Modal: z-index: 9999
- Lightbox: z-index: 10000

## 9. Viewport Units
**Problem**: Not accounting for mobile browser chrome
```css
/* Use dvh (dynamic viewport height) when available */
.full-height {
  height: 100vh;
  height: 100dvh; /* fallback for mobile browsers */
}
```

## 10. Grid Columns
**Problem**: Too many columns on mobile
```css
/* Responsive grid */
.grid {
  grid-template-columns: 1fr; /* mobile */
}

@media (min-width: 640px) {
  .grid {
    grid-template-columns: repeat(2, 1fr); /* tablet */
  }
}
```
