/**
 * Toast Notification System for Expense Tracker
 * Provides user-friendly notifications instead of alerts
 */

class ToastManager {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Create container if not exists
        if (!document.getElementById('toast-container')) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            document.body.appendChild(this.container);

            // Add styles
            const styles = document.createElement('style');
            styles.textContent = `
                #toast-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10001;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    max-width: 400px;
                    pointer-events: none;
                }

                @media (max-width: 480px) {
                    #toast-container {
                        top: 10px;
                        right: 10px;
                        left: 10px;
                        max-width: none;
                    }
                }

                .toast {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    padding: 14px 18px;
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
                    animation: toastSlideIn 0.3s ease;
                    pointer-events: auto;
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }

                .toast.exiting {
                    animation: toastSlideOut 0.3s ease forwards;
                }

                @keyframes toastSlideIn {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }

                @keyframes toastSlideOut {
                    from {
                        opacity: 1;
                        transform: translateX(0);
                    }
                    to {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                }

                .toast-icon {
                    font-size: 20px;
                    flex-shrink: 0;
                    margin-top: 2px;
                }

                .toast-content {
                    flex: 1;
                    min-width: 0;
                }

                .toast-title {
                    font-weight: 600;
                    font-size: 14px;
                    margin-bottom: 4px;
                    color: inherit;
                }

                .toast-message {
                    font-size: 13px;
                    opacity: 0.9;
                    line-height: 1.4;
                    word-wrap: break-word;
                }

                .toast-close {
                    background: none;
                    border: none;
                    color: inherit;
                    opacity: 0.6;
                    cursor: pointer;
                    font-size: 18px;
                    padding: 0;
                    margin-left: 8px;
                    flex-shrink: 0;
                    transition: opacity 0.2s;
                }

                .toast-close:hover {
                    opacity: 1;
                }

                .toast-progress {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 3px;
                    background: rgba(255, 255, 255, 0.3);
                    border-radius: 0 0 12px 12px;
                    overflow: hidden;
                }

                .toast-progress-bar {
                    height: 100%;
                    background: rgba(255, 255, 255, 0.7);
                    animation: progressShrink linear forwards;
                }

                @keyframes progressShrink {
                    from { width: 100%; }
                    to { width: 0%; }
                }

                /* Toast Types */
                .toast.success {
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    color: white;
                }

                .toast.error {
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                    color: white;
                }

                .toast.warning {
                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                    color: white;
                }

                .toast.info {
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: white;
                }

                .toast.loading {
                    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
                    color: white;
                }

                /* Loading Spinner */
                .toast-spinner {
                    width: 20px;
                    height: 20px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(styles);
        } else {
            this.container = document.getElementById('toast-container');
        }
    }

    /**
     * Show a toast notification
     * @param {Object} options - Toast options
     * @param {string} options.type - 'success' | 'error' | 'warning' | 'info' | 'loading'
     * @param {string} options.title - Toast title
     * @param {string} options.message - Toast message
     * @param {number} options.duration - Duration in ms (0 for persistent)
     * @param {boolean} options.showProgress - Show progress bar
     * @returns {HTMLElement} Toast element (for updating/removing)
     */
    show({ type = 'info', title = '', message = '', duration = 4000, showProgress = true }) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.style.position = 'relative';

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            loading: ''
        };

        toast.innerHTML = `
            ${type === 'loading'
                ? '<div class="toast-spinner"></div>'
                : `<span class="toast-icon">${icons[type]}</span>`
            }
            <div class="toast-content">
                ${title ? `<div class="toast-title">${title}</div>` : ''}
                <div class="toast-message">${message}</div>
            </div>
            ${type !== 'loading' ? '<button class="toast-close">×</button>' : ''}
            ${showProgress && duration > 0 ? `
                <div class="toast-progress">
                    <div class="toast-progress-bar" style="animation-duration: ${duration}ms"></div>
                </div>
            ` : ''}
        `;

        // Close button handler
        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.remove(toast));
        }

        this.container.appendChild(toast);

        // Auto remove after duration
        if (duration > 0) {
            setTimeout(() => this.remove(toast), duration);
        }

        return toast;
    }

    /**
     * Remove a toast
     * @param {HTMLElement} toast - Toast element to remove
     */
    remove(toast) {
        if (!toast || !toast.parentNode) return;

        toast.classList.add('exiting');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    /**
     * Update a loading toast to success/error
     * @param {HTMLElement} toast - Toast element
     * @param {Object} options - New options
     */
    update(toast, { type = 'success', title = '', message = '', duration = 3000 }) {
        if (!toast) return;

        toast.className = `toast ${type}`;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type]}</span>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${title}</div>` : ''}
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">×</button>
            ${duration > 0 ? `
                <div class="toast-progress">
                    <div class="toast-progress-bar" style="animation-duration: ${duration}ms"></div>
                </div>
            ` : ''}
        `;

        // Close button handler
        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.remove(toast));
        }

        // Auto remove after duration
        if (duration > 0) {
            setTimeout(() => this.remove(toast), duration);
        }
    }

    // Convenience methods
    success(message, title = 'Success') {
        return this.show({ type: 'success', title, message });
    }

    error(message, title = 'Error') {
        return this.show({ type: 'error', title, message, duration: 6000 });
    }

    warning(message, title = 'Warning') {
        return this.show({ type: 'warning', title, message });
    }

    info(message, title = '') {
        return this.show({ type: 'info', title, message });
    }

    loading(message, title = 'Loading') {
        return this.show({ type: 'loading', title, message, duration: 0, showProgress: false });
    }
}

// Initialize and export
const toast = new ToastManager();
window.toast = toast;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ToastManager;
}
