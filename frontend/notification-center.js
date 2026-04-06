/**
 * Notification Center — Bell icon with dropdown panel
 * Shows in-app notifications for voucher approvals, rejections, etc.
 * Subscribes to realtime for instant updates.
 */
const notificationCenter = (() => {
    'use strict';

    let isOpen = false;
    let notifications = [];
    let unreadCount = 0;
    let realtimeChannel = null;

    // ==================== Helpers ====================

    function sanitize(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function relativeTime(dateStr) {
        const d = new Date(dateStr);
        const now = new Date();
        const mins = Math.floor((now - d) / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        if (days < 7) return `${days}d ago`;
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }

    const TYPE_CONFIG = {
        voucher_submitted: { icon: '📩', color: '#8b5cf6' },
        voucher_approved: { icon: '✅', color: '#10b981' },
        voucher_rejected: { icon: '❌', color: '#ef4444' },
        voucher_reimbursed: { icon: '💰', color: '#06b6d4' },
        voucher_resubmitted: { icon: '🔄', color: '#f59e0b' },
        advance_submitted: { icon: '💸', color: '#8b5cf6' },
        advance_approved: { icon: '✅', color: '#10b981' },
        advance_rejected: { icon: '❌', color: '#ef4444' },
        advance_resubmitted: { icon: '🔄', color: '#f59e0b' },
        expense_added: { icon: '🧾', color: '#0ea5e9' },
        employee_joined: { icon: '👤', color: '#3b82f6' },
        project_created: { icon: '📁', color: '#a78bfa' },
        system: { icon: '🔔', color: '#64748b' }
    };

    // ==================== Init ====================

    async function init() {
        if (!isCompanyMode()) return;

        createBellIcon();
        // Defer notification count fetch — non-critical, don't block page render
        setTimeout(async () => {
            await refreshCount();
            subscribeRealtime();
        }, 2000);
    }

    function createBellIcon() {
        const userInfo = document.getElementById('userInfo');
        if (!userInfo || document.getElementById('notifBellBtn')) return;

        // We'll inject the bell via the header rendering in index.html
        // This is called after DOM is ready to update the badge count
    }

    // ==================== Badge Count ====================

    async function refreshCount() {
        try {
            unreadCount = await api.getUnreadCount();
            updateBadge();
        } catch (e) {
            console.warn('Notification count error:', e);
        }
    }

    function updateBadge() {
        const badge = document.getElementById('notifBadge');
        if (!badge) return;

        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    // ==================== Dropdown Panel ====================

    function toggle() {
        if (isOpen) {
            close();
        } else {
            open();
        }
    }

    function ensurePanel() {
        let panel = document.getElementById('notifPanel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'notifPanel';
            panel.className = 'notif-panel';
            panel.style.display = 'none';
            document.body.appendChild(panel);
        }
        return panel;
    }

    async function open() {
        const panel = ensurePanel();

        isOpen = true;
        panel.style.display = 'block';

        panel.innerHTML = '<div class="notif-loading">Loading...</div>';

        try {
            notifications = await api.getNotifications(30);
            renderList();
        } catch (e) {
            panel.innerHTML = `<div class="notif-loading" style="color:#ef4444;">Error loading notifications</div>`;
        }
    }

    function close() {
        const panel = document.getElementById('notifPanel');
        if (panel) panel.style.display = 'none';
        isOpen = false;
    }

    function renderList() {
        const panel = ensurePanel();
        if (!panel) return;

        if (notifications.length === 0) {
            panel.innerHTML = `
                <div class="notif-header">
                    <span>Notifications</span>
                </div>
                <div class="notif-empty">No notifications yet</div>
            `;
            return;
        }

        const items = notifications.map(n => {
            const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.system;
            const readClass = n.is_read ? 'notif-item--read' : '';
            return `
                <div class="notif-item ${readClass}" data-id="${n.id}" onclick="notificationCenter.handleClick('${n.id}', '${n.reference_type || ''}', '${n.reference_id || ''}')">
                    <div class="notif-item__icon" style="color:${cfg.color};">${cfg.icon}</div>
                    <div class="notif-item__content">
                        <div class="notif-item__title">${sanitize(n.title)}</div>
                        <div class="notif-item__message">${sanitize(n.message)}</div>
                        <div class="notif-item__time">${relativeTime(n.created_at)}</div>
                    </div>
                    ${!n.is_read ? '<div class="notif-item__dot"></div>' : ''}
                </div>
            `;
        }).join('');

        const hasUnread = notifications.some(n => !n.is_read);

        panel.innerHTML = `
            <div class="notif-header">
                <span>Notifications</span>
                ${hasUnread ? '<button class="notif-mark-all" onclick="notificationCenter.markAllRead()">Mark all read</button>' : ''}
            </div>
            <div class="notif-list">${items}</div>
        `;
    }

    // ==================== Actions ====================

    async function handleClick(notifId, refType, refId) {
        // Mark as read
        try {
            await api.markNotificationRead(notifId);
            const item = document.querySelector(`.notif-item[data-id="${notifId}"]`);
            if (item) {
                item.classList.add('notif-item--read');
                const dot = item.querySelector('.notif-item__dot');
                if (dot) dot.remove();
            }
            unreadCount = Math.max(0, unreadCount - 1);
            updateBadge();
        } catch (e) { /* ignore */ }

        // Navigate to referenced entity
        if (refType === 'voucher' && refId) {
            close();
            if (typeof approvalWorkflow !== 'undefined') {
                approvalWorkflow.openVoucherDetail(refId);
            }
        } else if (refType === 'advance' && refId) {
            close();
            if (typeof approvalWorkflow !== 'undefined') {
                approvalWorkflow.openAdvanceDetail(refId);
            }
        }
    }

    async function markAllRead() {
        try {
            await api.markAllNotificationsRead();
            notifications.forEach(n => n.is_read = true);
            unreadCount = 0;
            updateBadge();
            renderList();
        } catch (e) {
            window.expenseTracker?.showNotification('Failed to mark all read');
        }
    }

    // ==================== Realtime Subscription ====================

    function subscribeRealtime() {
        const supabase = window.supabaseClient?.get();
        if (!supabase) return;

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!user.id) return;

        realtimeChannel = supabase.channel('notifications-realtime')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {
                const notif = payload.new;
                if (!notif) return;

                // Update count
                unreadCount++;
                updateBadge();

                // Add to list if panel is open
                if (isOpen) {
                    notifications.unshift(notif);
                    renderList();
                }

                // Show toast
                const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system;
                if (window.toast) {
                    window.toast.show({
                        type: notif.type.includes('rejected') ? 'warning' : 'info',
                        title: notif.title,
                        message: notif.message,
                        duration: 5000
                    });
                }
            })
            .subscribe();
    }

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (isOpen && !e.target.closest('#notifPanel') && !e.target.closest('#notifBellBtn')) {
            close();
        }
    });

    // Escape to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) close();
    });

    return {
        init,
        toggle,
        open,
        close,
        handleClick,
        markAllRead,
        refreshCount,
        updateBadge
    };
})();

window.notificationCenter = notificationCenter;
