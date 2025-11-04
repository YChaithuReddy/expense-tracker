# Mobile Debugging Checklist

Use this checklist when investigating mobile layout issues:

## Layout & Structure

- [ ] **Viewport meta tag present?**
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ```

- [ ] **Box-sizing set correctly?**
  ```css
  *, *::before, *::after {
    box-sizing: border-box;
  }
  ```

- [ ] **Containers have max-width instead of fixed width?**

- [ ] **Overflow handled properly?**
  - Check for `overflow-x: hidden` on body/containers
  - Verify scrollable areas have `-webkit-overflow-scrolling: touch`

## Responsive Breakpoints

- [ ] **Mobile breakpoints defined?**
  - Small mobile: `@media (max-width: 480px)`
  - Tablet: `@media (max-width: 768px)`

- [ ] **Media queries in correct order?**
  - Mobile-first: Use `min-width`
  - Desktop-first: Use `max-width`

- [ ] **Breakpoints tested at actual device widths?**
  - 375px (iPhone SE)
  - 390px (iPhone 12/13/14)
  - 360px (Samsung Galaxy)

## Touch Targets

- [ ] **Buttons meet minimum size?**
  - Apple HIG: 44x44px
  - Material Design: 48x48px

- [ ] **Interactive elements have adequate spacing?**
  - Minimum 8px gap between touch targets

- [ ] **Tap highlight colors defined?**
  ```css
  -webkit-tap-highlight-color: rgba(0, 0, 0, 0.1);
  ```

## Typography

- [ ] **Base font size ≥ 16px?**
  - Prevents auto-zoom on iOS inputs

- [ ] **Line height appropriate for mobile?**
  - Body text: 1.5-1.6
  - Headings: 1.2-1.3

- [ ] **Text doesn't overflow containers?**
  ```css
  word-wrap: break-word;
  overflow-wrap: break-word;
  ```

## Flexbox & Grid

- [ ] **Flex items wrap on mobile?**
  ```css
  flex-wrap: wrap;
  ```

- [ ] **Grid columns reduce for mobile?**
  ```css
  grid-template-columns: 1fr; /* mobile */
  ```

- [ ] **Gap values reasonable for small screens?**

## Images & Media

- [ ] **Images responsive?**
  ```css
  img {
    max-width: 100%;
    height: auto;
  }
  ```

- [ ] **Image cards have appropriate height?**
  - Desktop: 200-250px
  - Mobile: 150-180px

- [ ] **Background images positioned correctly?**
  ```css
  background-size: cover;
  background-position: center;
  ```

## Modals & Overlays

- [ ] **Modal full-width on mobile?**
  ```css
  @media (max-width: 768px) {
    .modal { width: 100%; }
  }
  ```

- [ ] **Z-index hierarchy correct?**
  - Backdrop: 9998
  - Modal: 9999
  - Lightbox/Tooltips: 10000+

- [ ] **Modal scrolling works?**
  ```css
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  ```

- [ ] **Bottom buttons visible with keyboard open?**
  - Consider using `position: sticky`

## Spacing & Padding

- [ ] **Padding reduced for mobile?**
  - Desktop: 24px
  - Mobile: 12-16px

- [ ] **Margins don't cause horizontal scroll?**

- [ ] **Safe area insets considered?**
  ```css
  padding-bottom: env(safe-area-inset-bottom);
  ```

## Forms

- [ ] **Input font-size ≥ 16px?**
  - Prevents iOS zoom

- [ ] **Input heights meet touch target minimum?**

- [ ] **Select dropdowns styled for mobile?**

- [ ] **Form spacing adequate for touch?**

## Performance

- [ ] **Animations performant on mobile?**
  - Use `transform` and `opacity` only
  - Add `will-change` sparingly

- [ ] **Images optimized?**
  - Lazy loading implemented?
  - Appropriate resolution for mobile?

- [ ] **CSS bundle size reasonable?**

## Common Mobile-Specific Issues

- [ ] **Fixed positioning works on iOS?**
  - iOS Safari has issues with `position: fixed`

- [ ] **Landscape orientation handled?**

- [ ] **Pull-to-refresh doesn't conflict?**
  ```css
  overscroll-behavior: contain;
  ```

- [ ] **Sticky elements work correctly?**
  - Test with keyboard open
  - Test in landscape mode

## Testing Tools

Use these to verify fixes:

1. **Browser DevTools**
   - Chrome: Device Mode (F12 → Toggle Device Toolbar)
   - Firefox: Responsive Design Mode (Ctrl+Shift+M)

2. **Real Devices**
   - Test on actual iOS and Android devices
   - Use BrowserStack or similar for device testing

3. **Viewport Sizes to Test**
   ```
   320px - Small mobile (iPhone SE)
   375px - Medium mobile (iPhone 12/13/14)
   390px - Large mobile (iPhone 14 Pro)
   414px - iPhone Plus models
   768px - Tablet (iPad)
   ```

4. **Orientation**
   - Portrait (default)
   - Landscape

5. **Browser Testing**
   - Mobile Safari (iOS)
   - Chrome Mobile (Android)
   - Samsung Internet
   - Firefox Mobile

## Quick CSS Debugging Snippets

```css
/* Visual debugging - outline all elements */
* { outline: 1px solid red !important; }

/* Check for overflow issues */
* { overflow: visible !important; }

/* See element boundaries */
* { background: rgba(255, 0, 0, 0.1) !important; }
```
