/* Activity Log Module - Timeline of all user actions */
const activityLog = (() => {
    'use strict';

    const ACTION_MAP = {
        expense_added:   { icon: '\u{1F4F7}', color: '#22c55e' },
        expense_deleted: { icon: '\u{1F5D1}\uFE0F', color: '#ef4444' },
        expense_edited:  { icon: '\u270F\uFE0F',     color: '#f59e0b' },
        sheets_exported: { icon: '\u2601\uFE0F',     color: '#3b82f6' },
        pdf_generated:   { icon: '\u{1F4E6}',        color: '#a855f7' },
        kodo_submitted:  { icon: '\u{1F3E2}',        color: '#06b6d4' },
        email_sent:      { icon: '\u{1F4E7}',        color: '#14b8a6' },
        pdf_uploaded:    { icon: '\u{1F4C4}',        color: '#f59e0b' },
        pdf_deleted:     { icon: '\u{1F5D1}\uFE0F', color: '#ef4444' },
        data_cleared:    { icon: '\u26A0\uFE0F',     color: '#ef4444' }
    };
    const DEFAULT_ACTION = { icon: '\u{1F4CC}', color: '#6b7280' };

    /* ── Relative time ── */
    function relativeTime(isoDate) {
        const now = Date.now();
        const then = new Date(isoDate).getTime();
        const diffSec = Math.floor((now - then) / 1000);

        if (diffSec < 60)    return 'Just now';
        if (diffSec < 3600)  return `${Math.floor(diffSec / 60)} min ago`;
        if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
        if (diffSec < 172800) return 'Yesterday';
        if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} days ago`;

        const d = new Date(isoDate);
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return `${months[d.getMonth()]} ${d.getDate()}`;
    }

    /* ── Render ── */
    function renderTimeline(entries) {
        const body = document.getElementById('activityLogBody');
        if (!body) return;

        if (!entries || entries.length === 0) {
            body.innerHTML =
                '<div class="activity-empty">' +
                    '<p>No activity yet. Start adding expenses to see your history here.</p>' +
                '</div>';
            return;
        }

        const fragment = document.createDocumentFragment();

        entries.forEach(entry => {
            const meta = ACTION_MAP[entry.action] || DEFAULT_ACTION;

            const row = document.createElement('div');
            row.className = 'activity-entry';

            const iconDiv = document.createElement('div');
            iconDiv.className = 'activity-entry__icon';
            iconDiv.style.background = meta.color + '10';
            iconDiv.style.color = meta.color;
            iconDiv.textContent = meta.icon;

            const content = document.createElement('div');
            content.className = 'activity-entry__content';

            const actionDiv = document.createElement('div');
            actionDiv.className = 'activity-entry__action';
            actionDiv.textContent = entry.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'activity-entry__details';
            detailsDiv.textContent = entry.details || '';

            const timeDiv = document.createElement('div');
            timeDiv.className = 'activity-entry__time';
            timeDiv.textContent = relativeTime(entry.created_at);

            content.appendChild(actionDiv);
            if (entry.details) content.appendChild(detailsDiv);
            content.appendChild(timeDiv);

            row.appendChild(iconDiv);
            row.appendChild(content);
            fragment.appendChild(row);
        });

        body.innerHTML = '';
        body.appendChild(fragment);
    }

    /* ── Open / Close ── */
    async function open() {
        const modal = document.getElementById('activityLogModal');
        if (!modal) return;

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Show loading state
        const body = document.getElementById('activityLogBody');
        if (body) body.innerHTML = '<div class="activity-empty"><p>Loading activity...</p></div>';

        try {
            const entries = await window.api.getActivityLog(50);
            renderTimeline(entries);
        } catch (err) {
            console.error('Failed to load activity log:', err);
            if (body) {
                body.innerHTML =
                    '<div class="activity-empty"><p>Failed to load activity log. Please try again.</p></div>';
            }
        }
    }

    function close() {
        const modal = document.getElementById('activityLogModal');
        if (!modal) return;

        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    /* ── Escape key ── */
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            var modal = document.getElementById('activityLogModal');
            if (modal && modal.classList.contains('active')) {
                close();
            }
        }
    });

    return { open: open, close: close };
})();
