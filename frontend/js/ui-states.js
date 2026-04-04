/* frontend/js/ui-states.js */
/* Reusable loading states and error handling utilities */

const UIStates = {

  // =========================================================================
  // PAGE-LEVEL LOADING
  // =========================================================================

  showPageLoading(message = 'Loading...') {
    if (document.querySelector('.page-loading-overlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'page-loading-overlay';
    overlay.innerHTML = `
      <div class="page-loading-spinner"></div>
      <p class="page-loading-message">${this._escapeHtml(message)}</p>
    `;
    document.body.appendChild(overlay);
  },

  hidePageLoading() {
    const overlay = document.querySelector('.page-loading-overlay');
    if (overlay) {
      overlay.classList.add('fade-out');
      overlay.addEventListener('animationend', () => overlay.remove());
    }
  },

  // =========================================================================
  // SECTION-LEVEL LOADING (SKELETON)
  // =========================================================================

  showSectionLoading(containerId, rows = 3) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.dataset.originalContent = container.innerHTML;
    let skeletonHtml = '<div class="skeleton-container">';
    for (let i = 0; i < rows; i++) {
      skeletonHtml += `
        <div class="skeleton-row">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text" style="width: 75%;"></div>
        </div>
      `;
    }
    skeletonHtml += '</div>';
    container.innerHTML = skeletonHtml;
  },

  hideSectionLoading(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (container.dataset.originalContent !== undefined) {
      container.innerHTML = container.dataset.originalContent;
      delete container.dataset.originalContent;
    }
  },

  // =========================================================================
  // BUTTON LOADING
  // =========================================================================

  setButtonLoading(button, text = 'Loading...') {
    if (!button) return;
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.dataset.originalHtml = button.innerHTML;
    button.innerHTML = '<span class="btn-spinner"></span> ' + this._escapeHtml(text);
    button.classList.add('btn-loading');
  },

  resetButton(button) {
    if (!button) return;
    button.disabled = false;
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    } else if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
    }
    delete button.dataset.originalText;
    button.classList.remove('btn-loading');
  },

  // =========================================================================
  // TABLE LOADING (SKELETON ROWS)
  // =========================================================================

  showTableLoading(tableBodyId, columns = 4, rows = 5) {
    const tbody = document.getElementById(tableBodyId);
    if (!tbody) return;
    tbody.dataset.originalContent = tbody.innerHTML;
    let html = '';
    for (let r = 0; r < rows; r++) {
      html += '<tr class="skeleton-table-row">';
      for (let c = 0; c < columns; c++) {
        html += '<td><div class="skeleton skeleton-text"></div></td>';
      }
      html += '</tr>';
    }
    tbody.innerHTML = html;
  },

  hideTableLoading(tableBodyId) {
    const tbody = document.getElementById(tableBodyId);
    if (!tbody) return;
    if (tbody.dataset.originalContent !== undefined) {
      tbody.innerHTML = tbody.dataset.originalContent;
      delete tbody.dataset.originalContent;
    }
  },

  // =========================================================================
  // INLINE LOADING
  // =========================================================================

  showInlineLoading(elementId, text = 'Loading...') {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.dataset.originalContent = el.innerHTML;
    el.innerHTML = '<span class="inline-spinner"></span> ' + this._escapeHtml(text);
  },

  hideInlineLoading(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (el.dataset.originalContent !== undefined) {
      el.innerHTML = el.dataset.originalContent;
      delete el.dataset.originalContent;
    }
  },

  // =========================================================================
  // TOAST NOTIFICATIONS
  // =========================================================================

  _toastContainer: null,

  _getToastContainer() {
    if (!this._toastContainer || !document.body.contains(this._toastContainer)) {
      this._toastContainer = document.createElement('div');
      this._toastContainer.className = 'toast-container';
      document.body.appendChild(this._toastContainer);
    }
    return this._toastContainer;
  },

  showToast(message, type = 'info', duration = 3000) {
    const container = this._getToastContainer();
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;

    const icons = {
      success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
      error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-content">
        <span class="toast-message">${this._escapeHtml(message)}</span>
      </div>
      <button class="toast-close" aria-label="Close notification">&times;</button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => {
      this._dismissToast(toast);
    });

    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => this._dismissToast(toast), duration);
    }

    return toast;
  },

  _dismissToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.add('toast-exit');
    toast.addEventListener('animationend', () => toast.remove());
  },

  // =========================================================================
  // ERROR BANNER
  // =========================================================================

  showErrorBanner(containerId, message, retryCallback = null) {
    this.hideErrorBanner(containerId);
    const container = document.getElementById(containerId);
    if (!container) return;

    const banner = document.createElement('div');
    banner.className = 'error-banner';
    banner.innerHTML = `
      <div class="error-banner-content">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        <span>${this._escapeHtml(message)}</span>
      </div>
      ${retryCallback ? '<button class="error-banner-retry btn btn-sm btn-outline">Retry</button>' : ''}
    `;

    if (retryCallback) {
      banner.querySelector('.error-banner-retry').addEventListener('click', retryCallback);
    }

    container.insertBefore(banner, container.firstChild);
  },

  hideErrorBanner(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const banner = container.querySelector('.error-banner');
    if (banner) banner.remove();
  },

  // =========================================================================
  // EMPTY STATE
  // =========================================================================

  showEmptyState(containerId, message, actionText = null, actionCallback = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="empty-state">
        <svg class="empty-state-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
          <polyline points="13 2 13 9 20 9"/>
        </svg>
        <p class="empty-state-message">${this._escapeHtml(message)}</p>
        ${actionText ? `<button class="empty-state-action btn btn-primary">${this._escapeHtml(actionText)}</button>` : ''}
      </div>
    `;

    if (actionText && actionCallback) {
      container.querySelector('.empty-state-action').addEventListener('click', actionCallback);
    }
  },

  // =========================================================================
  // NETWORK STATUS DETECTION
  // =========================================================================

  initNetworkDetection() {
    window.addEventListener('offline', () => {
      this.showToast('You are offline. Some features may not work.', 'warning', 0);
    });

    window.addEventListener('online', () => {
      // Dismiss any offline toasts
      const container = this._getToastContainer();
      const offlineToasts = container.querySelectorAll('.toast-warning');
      offlineToasts.forEach(t => this._dismissToast(t));
      this.showToast('Connection restored.', 'success', 3000);
    });
  },

  // =========================================================================
  // FORM ERRORS
  // =========================================================================

  showFieldError(inputElement, message) {
    this.clearFieldError(inputElement);
    if (!inputElement) return;
    inputElement.classList.add('field-error');
    const errorEl = document.createElement('span');
    errorEl.className = 'field-error-message';
    errorEl.textContent = message;
    inputElement.parentNode.insertBefore(errorEl, inputElement.nextSibling);
  },

  clearFieldError(inputElement) {
    if (!inputElement) return;
    inputElement.classList.remove('field-error');
    const existing = inputElement.parentNode.querySelector('.field-error-message');
    if (existing) existing.remove();
  },

  clearAllFieldErrors(formElement) {
    if (!formElement) return;
    formElement.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));
    formElement.querySelectorAll('.field-error-message').forEach(el => el.remove());
  },

  // =========================================================================
  // UTILITY
  // =========================================================================

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
