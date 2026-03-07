/* Activity Log Module - Enhanced file-manager style */
const activityLog = (() => {
    'use strict';

    /* ── SVG Icons per action type ── */
    const ACTION_MAP = {
        expense_added: {
            label: 'Expense Added',
            color: '#22c55e',
            bg: 'rgba(34,197,94,0.1)',
            svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>'
        },
        expense_deleted: {
            label: 'Expense Deleted',
            color: '#ef4444',
            bg: 'rgba(239,68,68,0.1)',
            svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>'
        },
        expense_edited: {
            label: 'Expense Edited',
            color: '#f59e0b',
            bg: 'rgba(245,158,11,0.1)',
            svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
        },
        sheets_exported: {
            label: 'Sheets Exported',
            color: '#3b82f6',
            bg: 'rgba(59,130,246,0.1)',
            svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
        },
        pdf_generated: {
            label: 'PDF Generated',
            color: '#a855f7',
            bg: 'rgba(168,85,247,0.1)',
            svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'
        },
        kodo_submitted: {
            label: 'Kodo Submitted',
            color: '#06b6d4',
            bg: 'rgba(6,182,212,0.1)',
            svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a4 4 0 00-8 0v2"/><circle cx="12" cy="14" r="1.5"/></svg>'
        },
        email_sent: {
            label: 'Email Sent',
            color: '#14b8a6',
            bg: 'rgba(20,184,166,0.1)',
            svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>'
        },
        pdf_uploaded: {
            label: 'PDF Uploaded',
            color: '#f59e0b',
            bg: 'rgba(245,158,11,0.1)',
            svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
        },
        pdf_deleted: {
            label: 'PDF Deleted',
            color: '#ef4444',
            bg: 'rgba(239,68,68,0.1)',
            svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>'
        },
        data_cleared: {
            label: 'Data Cleared',
            color: '#ef4444',
            bg: 'rgba(239,68,68,0.1)',
            svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
        }
    };
    const DEFAULT_ACTION = {
        label: 'Action',
        color: '#6b7280',
        bg: 'rgba(107,114,128,0.1)',
        svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    let _allEntries = [];

    /* ── Helpers ── */
    function relativeTime(isoDate) {
        const now = Date.now();
        const then = new Date(isoDate).getTime();
        const diffSec = Math.floor((now - then) / 1000);

        if (diffSec < 60)    return 'Just now';
        if (diffSec < 3600)  return `${Math.floor(diffSec / 60)}m ago`;
        if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
        if (diffSec < 172800) return 'Yesterday';
        if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;

        const d = new Date(isoDate);
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return `${months[d.getMonth()]} ${d.getDate()}`;
    }

    function dateKey(isoDate) {
        const d = new Date(isoDate);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (d.toDateString() === today.toDateString()) return 'Today';
        if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /* ── Update stats ── */
    function updateStats(entries) {
        const totalEl = document.getElementById('activityTotalCount');
        const todayEl = document.getElementById('activityTodayCount');
        if (totalEl) totalEl.textContent = entries.length;
        if (todayEl) {
            const todayStr = new Date().toDateString();
            const todayCount = entries.filter(e => new Date(e.created_at).toDateString() === todayStr).length;
            todayEl.textContent = todayCount;
        }
    }

    /* ── Render rows grouped by date ── */
    function renderList(entries) {
        const body = document.getElementById('activityLogBody');
        if (!body) return;

        if (!entries || entries.length === 0) {
            body.innerHTML =
                '<div class="activity-empty">' +
                    '<div class="activity-empty__icon">📋</div>' +
                    '<div class="activity-empty__title">No activity yet</div>' +
                    '<div class="activity-empty__text">Start adding expenses to see your history here.</div>' +
                '</div>';
            return;
        }

        // Group by date
        const groups = [];
        let currentKey = '';
        entries.forEach(entry => {
            const key = dateKey(entry.created_at);
            if (key !== currentKey) {
                currentKey = key;
                groups.push({ date: key, items: [] });
            }
            groups[groups.length - 1].items.push(entry);
        });

        let html = '<div class="activity-list">';
        groups.forEach(group => {
            html += `<div class="activity-date-header">${escapeHtml(group.date)}</div>`;
            group.items.forEach(entry => {
                const meta = ACTION_MAP[entry.action] || DEFAULT_ACTION;
                const label = meta.label || entry.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                const details = entry.details ? escapeHtml(entry.details) : '';
                const time = relativeTime(entry.created_at);
                const searchText = (label + ' ' + (entry.details || '')).toLowerCase();

                html += `
                <div class="activity-row" data-search="${escapeHtml(searchText)}">
                    <div class="activity-row__icon" style="background:${meta.bg};color:${meta.color}">
                        ${meta.svg}
                    </div>
                    <div class="activity-row__info">
                        <div class="activity-row__action">${escapeHtml(label)}</div>
                        ${details ? `<div class="activity-row__details">${details}</div>` : ''}
                    </div>
                    <div class="activity-row__time">${escapeHtml(time)}</div>
                </div>`;
            });
        });
        html += '</div>';

        body.innerHTML = html;
    }

    /* ── Filter ── */
    function filterEntries(query) {
        const q = query.toLowerCase().trim();
        const rows = document.querySelectorAll('.activity-row');
        const headers = document.querySelectorAll('.activity-date-header');

        rows.forEach(row => {
            const text = row.getAttribute('data-search') || '';
            row.style.display = (!q || text.includes(q)) ? '' : 'none';
        });

        // Hide date headers if all rows beneath are hidden
        headers.forEach(header => {
            let next = header.nextElementSibling;
            let anyVisible = false;
            while (next && !next.classList.contains('activity-date-header')) {
                if (next.classList.contains('activity-row') && next.style.display !== 'none') {
                    anyVisible = true;
                    break;
                }
                next = next.nextElementSibling;
            }
            header.style.display = anyVisible ? '' : 'none';
        });
    }

    /* ── Open / Close ── */
    async function open() {
        const modal = document.getElementById('activityLogModal');
        if (!modal) return;

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Clear search
        const searchInput = document.getElementById('activitySearchInput');
        if (searchInput) searchInput.value = '';

        const body = document.getElementById('activityLogBody');
        if (body) body.innerHTML = '<div class="activity-log-loading">Loading activity...</div>';

        try {
            const entries = await window.api.getActivityLog(50);
            _allEntries = entries || [];
            updateStats(_allEntries);
            renderList(_allEntries);
        } catch (err) {
            console.error('Failed to load activity log:', err);
            if (body) {
                body.innerHTML =
                    '<div class="activity-empty">' +
                        '<div class="activity-empty__title">Failed to load</div>' +
                        '<div class="activity-empty__text">Please try again.</div>' +
                    '</div>';
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

    return { open: open, close: close, filter: filterEntries };
})();
