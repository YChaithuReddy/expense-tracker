/**
 * Realtime Module - Supabase Realtime subscriptions
 * 1. Real-time sync: expenses table changes across devices
 * 2. Live notifications: toast alerts for remote changes
 * 3. Live activity feed: auto-update activity log modal
 */
const realtimeManager = (() => {
    'use strict';

    let _channel = null;
    let _activityChannel = null;
    let _notifyChannel = null;
    let _userId = null;
    let _enabled = false;

    /* ── Connection status indicator ── */
    function setStatus(status) {
        const dot = document.getElementById('realtimeStatus');
        if (!dot) return;
        dot.className = 'realtime-dot realtime-dot--' + status;
        dot.title = status === 'connected' ? 'Live sync active'
            : status === 'connecting' ? 'Connecting...'
            : 'Offline';
    }

    /* ── Start subscriptions ── */
    function connect() {
        const client = window.supabaseClient?.get();
        if (!client) {
            console.warn('[Realtime] Supabase client not ready');
            return;
        }

        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (!user?.id) {
            console.warn('[Realtime] No user, skipping realtime');
            return;
        }

        _userId = user.id;
        _enabled = true;
        setStatus('connecting');

        // ── 1. Expenses channel: sync across devices ──
        _channel = client.channel('expenses-sync')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'expenses',
                filter: `user_id=eq.${_userId}`
            }, (payload) => {
                console.log('[Realtime] Expense inserted:', payload.new?.id);
                handleExpenseChange('added', payload.new);
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'expenses',
                filter: `user_id=eq.${_userId}`
            }, (payload) => {
                console.log('[Realtime] Expense updated:', payload.new?.id);
                handleExpenseChange('updated', payload.new);
            })
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'expenses',
                filter: `user_id=eq.${_userId}`
            }, (payload) => {
                console.log('[Realtime] Expense deleted:', payload.old?.id);
                handleExpenseChange('deleted', payload.old);
            })
            .subscribe((status) => {
                console.log('[Realtime] Expenses channel:', status);
                if (status === 'SUBSCRIBED') setStatus('connected');
                if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setStatus('disconnected');
            });

        // ── 2. Activity log channel: live feed ──
        _activityChannel = client.channel('activity-sync')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'activity_log',
                filter: `user_id=eq.${_userId}`
            }, (payload) => {
                console.log('[Realtime] New activity:', payload.new?.action);
                handleNewActivity(payload.new);
            })
            .subscribe((status) => {
                console.log('[Realtime] Activity channel:', status);
            });

        // ── 3. Broadcast channel: cross-tab notifications ──
        _notifyChannel = client.channel(`user-notify-${_userId}`)
            .on('broadcast', { event: 'notification' }, (payload) => {
                console.log('[Realtime] Broadcast notification:', payload);
                showRealtimeToast(payload.payload);
            })
            .subscribe();

        // ── 4. Voucher changes: approval status updates ──
        if (typeof isCompanyMode === 'function' && isCompanyMode()) {
            client.channel('vouchers-sync')
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'vouchers'
                }, (payload) => {
                    const v = payload.new;
                    if (!v) return;
                    const isInvolved = v.submitted_by === _userId || v.manager_id === _userId || v.accountant_id === _userId;
                    if (!isInvolved) return;

                    const statusLabels = {
                        pending_manager: 'submitted for your approval',
                        pending_accountant: 'approved by manager, awaiting your review',
                        approved: 'has been approved!',
                        rejected: 'was rejected'
                    };
                    const msg = statusLabels[v.status];
                    if (msg) {
                        showRealtimeToast({
                            type: v.status === 'rejected' ? 'warning' : 'info',
                            title: `Voucher ${v.voucher_number}`,
                            message: msg
                        });
                    }
                })
                .subscribe();
        }
    }

    /* ── Handle expense changes ── */
    // Debounce reload to avoid rapid-fire refreshes
    let _reloadTimer = null;
    function handleExpenseChange(type, data) {
        if (!_enabled) return;

        // Show toast for remote changes
        const vendor = data?.vendor || 'expense';
        const amount = data?.amount ? `Rs.${Number(data.amount).toLocaleString('en-IN')}` : '';

        if (type === 'added') {
            showRealtimeToast({ type: 'success', title: 'Synced', message: `New expense: ${vendor} ${amount}` });
        } else if (type === 'updated') {
            showRealtimeToast({ type: 'info', title: 'Updated', message: `${vendor} ${amount} was modified` });
        } else if (type === 'deleted') {
            showRealtimeToast({ type: 'warning', title: 'Deleted', message: `An expense was removed` });
        }

        // Debounced reload of expenses list
        clearTimeout(_reloadTimer);
        _reloadTimer = setTimeout(() => {
            if (window.expenseTracker && typeof window.expenseTracker.loadExpenses === 'function') {
                console.log('[Realtime] Refreshing expenses list...');
                window.expenseTracker.loadExpenses();
            }
        }, 500);
    }

    /* ── Handle new activity ── */
    function handleNewActivity(entry) {
        if (!_enabled) return;

        // If activity log modal is open, refresh it
        const modal = document.getElementById('activityLogModal');
        if (modal && modal.classList.contains('active') && window.activityLog) {
            // Re-open refreshes the data
            window.activityLog.open();
        }
    }

    /* ── Show realtime toast ── */
    function showRealtimeToast(data) {
        if (!window.toast) return;
        const type = data.type || 'info';
        const title = data.title || 'Sync';
        const message = data.message || '';
        window.toast.show({ type, title, message, duration: 3000 });
    }

    /* ── Send broadcast notification ── */
    function broadcast(event, payload) {
        if (!_notifyChannel) return;
        _notifyChannel.send({
            type: 'broadcast',
            event: event,
            payload: payload
        });
    }

    /* ── Disconnect ── */
    function disconnect() {
        _enabled = false;
        const client = window.supabaseClient?.get();
        if (!client) return;

        if (_channel) {
            client.removeChannel(_channel);
            _channel = null;
        }
        if (_activityChannel) {
            client.removeChannel(_activityChannel);
            _activityChannel = null;
        }
        if (_notifyChannel) {
            client.removeChannel(_notifyChannel);
            _notifyChannel = null;
        }
        setStatus('disconnected');
        console.log('[Realtime] Disconnected');
    }

    /* ── Auto-connect when auth is ready ── */
    function init() {
        // Listen for auth state to connect/disconnect
        const client = window.supabaseClient?.get();
        if (client) {
            client.auth.onAuthStateChange((event) => {
                if (event === 'SIGNED_IN') {
                    // Small delay to ensure user data is in localStorage
                    setTimeout(connect, 500);
                } else if (event === 'SIGNED_OUT') {
                    disconnect();
                }
            });
        }

        // If already logged in, connect now
        const user = localStorage.getItem('user');
        if (user) {
            // Wait a moment for supabase client to fully initialize
            setTimeout(connect, 1000);
        }
    }

    // Auto-init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return { connect, disconnect, broadcast, setStatus };
})();
