# Mobile Fix Templates

## Responsive Modal Template

```css
/* Desktop */
.modal-panel {
  position: fixed;
  right: 0;
  top: 0;
  height: 100vh;
  width: 480px;
  overflow-y: auto;
}

/* Mobile - Full screen */
@media (max-width: 768px) {
  .modal-panel {
    width: 100%;
    max-width: 100%;
    left: 0;
    right: 0;
  }
}

/* Small mobile - Reduce padding */
@media (max-width: 480px) {
  .modal-panel {
    padding: 12px;
  }
}
```

## Responsive Button Group

```css
.action-buttons {
  display: flex;
  gap: 12px;
  padding: 16px;
}

.action-buttons button {
  flex: 1;
  padding: 12px 16px;
  min-height: 44px; /* Touch target */
  border-radius: 12px;
}

@media (max-width: 480px) {
  .action-buttons {
    padding: 12px;
    gap: 8px;
  }

  .action-buttons button {
    padding: 10px 12px;
    font-size: 13px;
  }
}
```

## Responsive Grid/Stats

```css
/* Desktop - 4 columns */
.stats-container {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  padding: 24px;
}

/* Tablet - 2 columns */
@media (max-width: 768px) {
  .stats-container {
    grid-template-columns: repeat(2, 1fr);
    padding: 16px;
  }
}

/* Mobile - Horizontal scroll */
@media (max-width: 480px) {
  .stats-container {
    display: flex;
    overflow-x: auto;
    padding: 12px;
    gap: 8px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .stats-container::-webkit-scrollbar {
    display: none;
  }

  .stat-card {
    flex: 0 0 auto;
    min-width: 85px;
  }
}
```

## Responsive Typography

```css
/* Base (mobile-first) */
h1 { font-size: 24px; }
h2 { font-size: 20px; }
h3 { font-size: 18px; }
body { font-size: 16px; }

/* Tablet */
@media (min-width: 768px) {
  h1 { font-size: 32px; }
  h2 { font-size: 24px; }
  h3 { font-size: 20px; }
}

/* Desktop */
@media (min-width: 1024px) {
  h1 { font-size: 40px; }
  h2 { font-size: 28px; }
  h3 { font-size: 22px; }
}
```

## Responsive Form Inputs

```css
.form-group {
  margin-bottom: 16px;
}

.form-input {
  width: 100%;
  padding: 12px 16px;
  font-size: 16px; /* Prevents zoom on iOS */
  border-radius: 8px;
  min-height: 44px; /* Touch target */
}

@media (max-width: 480px) {
  .form-group {
    margin-bottom: 12px;
  }

  .form-input {
    padding: 10px 12px;
    font-size: 16px; /* Keep 16px to prevent zoom */
  }
}
```

## Responsive Image Card

```css
.image-card {
  border-radius: 20px;
  overflow: hidden;
}

.image-preview {
  width: 100%;
  height: 200px;
  overflow: hidden;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

@media (max-width: 480px) {
  .image-card {
    border-radius: 12px;
  }

  .image-preview {
    height: 150px;
  }
}
```

## Responsive Header

```css
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.close-button {
  padding: 8px;
  min-width: 44px;
  min-height: 44px;
}

@media (max-width: 480px) {
  .modal-header {
    padding: 12px 16px;
  }

  .header-title {
    gap: 8px;
  }

  .header-title h2 {
    font-size: 18px;
  }

  .close-button {
    padding: 6px;
    min-width: 36px;
    min-height: 36px;
  }
}
```

## Safe Area for Mobile Browsers

```css
/* Account for notches and bottom bars */
.modal-panel {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

## Prevent Text Selection Issues

```css
/* For buttons and interactive elements on mobile */
.button, .interactive-element {
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  user-select: none;
}
```
