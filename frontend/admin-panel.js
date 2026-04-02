/**
 * Admin Panel — Organization & Employee Management
 * Only visible to users with role === 'admin'
 * Follows the IIFE module pattern (same as activity-log.js, expense-detail.js)
 */
const adminPanel = (() => {
    'use strict';

    let isOpen = false;
    let organization = null;
    let employees = [];

    // ==================== Helpers ====================

    function sanitize(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function getRoleBadgeClass(role) {
        const map = {
            admin: 'admin-role-badge--admin',
            manager: 'admin-role-badge--manager',
            accountant: 'admin-role-badge--accountant',
            employee: 'admin-role-badge--employee'
        };
        return map[role] || 'admin-role-badge--employee';
    }

    // ==================== Organization Setup ====================

    async function initOrganization() {
        try {
            organization = await api.getOrganization();
            if (organization) {
                renderOrgInfo();
                await loadEmployees();
            } else {
                renderOrgSetup();
            }
        } catch (e) {
            console.error('Admin panel init error:', e);
        }
    }

    function renderOrgSetup() {
        const container = document.getElementById('adminPanelContent');
        if (!container) return;

        container.innerHTML = `
            <div class="admin-org-setup">
                <div class="admin-org-setup__icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="1.5">
                        <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4"/>
                    </svg>
                </div>
                <h3>Set Up Your Organization</h3>
                <p>Create your company profile to enable team expense management</p>
                <form id="orgSetupForm" class="admin-org-form">
                    <div class="admin-form-group">
                        <label for="orgName">Company Name *</label>
                        <input type="text" id="orgName" placeholder="e.g., Acme Industries Pvt Ltd" required>
                    </div>
                    <div class="admin-form-group">
                        <label for="orgDomain">Email Domain</label>
                        <input type="text" id="orgDomain" placeholder="e.g., acme.com (optional)">
                        <small>Employees with this email domain can be auto-matched</small>
                    </div>
                    <button type="submit" class="admin-btn admin-btn--primary">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                        Create Organization
                    </button>
                </form>
            </div>
        `;

        document.getElementById('orgSetupForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('orgName').value.trim();
            const domain = document.getElementById('orgDomain').value.trim() || null;

            if (!name) return;

            const btn = e.target.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Creating...';

            try {
                const result = await api.createOrganization(name, domain);
                organization = result.data;

                // Refresh user data in localStorage
                await fetchCurrentUser();

                window.expenseTracker?.showNotification('Organization created! You are now the admin.');
                await api.logActivity?.('org_created', `Created organization: ${name}`);

                renderOrgInfo();
                await loadEmployees();
            } catch (error) {
                window.expenseTracker?.showNotification('Failed: ' + error.message);
                btn.disabled = false;
                btn.textContent = 'Create Organization';
            }
        });
    }

    function renderOrgInfo() {
        const header = document.getElementById('adminOrgHeader');
        if (!header || !organization) return;

        header.innerHTML = `
            <div class="admin-org-info">
                <div class="admin-org-info__name">${sanitize(organization.name)}</div>
                ${organization.domain ? `<div class="admin-org-info__domain">@${sanitize(organization.domain)}</div>` : ''}
            </div>
        `;
    }

    // ==================== Employee Management ====================

    async function loadEmployees() {
        if (!organization) return;

        try {
            employees = await api.getEmployeeWhitelist(organization.id);
            renderEmployeeList();
            renderStats();
        } catch (e) {
            console.error('Failed to load employees:', e);
        }
    }

    function renderStats() {
        const statsEl = document.getElementById('adminStats');
        if (!statsEl) return;

        const total = employees.length;
        const active = employees.filter(e => e.is_active).length;
        const byRole = {
            admin: employees.filter(e => e.role === 'admin').length,
            manager: employees.filter(e => e.role === 'manager').length,
            accountant: employees.filter(e => e.role === 'accountant').length,
            employee: employees.filter(e => e.role === 'employee').length
        };

        statsEl.innerHTML = `
            <div class="admin-stat-pill">Total: <strong>${total}</strong></div>
            <div class="admin-stat-pill admin-stat-pill--active">Active: <strong>${active}</strong></div>
            <div class="admin-stat-pill admin-stat-pill--admin">Admins: <strong>${byRole.admin}</strong></div>
            <div class="admin-stat-pill admin-stat-pill--manager">Managers: <strong>${byRole.manager}</strong></div>
            <div class="admin-stat-pill admin-stat-pill--accountant">Accountants: <strong>${byRole.accountant}</strong></div>
        `;
    }

    function renderEmployeeList() {
        const container = document.getElementById('adminEmployeeList');
        if (!container) return;

        if (employees.length === 0) {
            container.innerHTML = `
                <div class="admin-empty">
                    <p>No employees imported yet. Upload a CSV to get started.</p>
                </div>
            `;
            return;
        }

        const rows = employees.map(emp => `
            <tr class="${emp.is_active ? '' : 'admin-row--inactive'}">
                <td><span class="admin-emp-id">${sanitize(emp.employee_id)}</span></td>
                <td>${sanitize(emp.name)}</td>
                <td class="admin-email">${sanitize(emp.email)}</td>
                <td>${sanitize(emp.department || '-')}</td>
                <td>${sanitize(emp.designation || '-')}</td>
                <td>
                    <select class="admin-role-select" data-id="${emp.id}" data-current="${emp.role}" onchange="adminPanel.changeRole(this)">
                        <option value="employee" ${emp.role === 'employee' ? 'selected' : ''}>Employee</option>
                        <option value="manager" ${emp.role === 'manager' ? 'selected' : ''}>Manager</option>
                        <option value="accountant" ${emp.role === 'accountant' ? 'selected' : ''}>Accountant</option>
                        <option value="admin" ${emp.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
                <td>
                    <span class="admin-status-dot ${emp.is_active ? 'admin-status-dot--active' : 'admin-status-dot--inactive'}"></span>
                    ${emp.is_active ? 'Active' : 'Inactive'}
                </td>
                <td>
                    <button class="admin-action-btn" onclick="adminPanel.toggleActive('${emp.id}', ${emp.is_active})" title="${emp.is_active ? 'Deactivate' : 'Activate'}">
                        ${emp.is_active
                            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
                            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
                        }
                    </button>
                </td>
            </tr>
        `).join('');

        container.innerHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Emp ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Department</th>
                        <th>Designation</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    // ==================== CSV Import ====================

    function renderCSVImport() {
        const container = document.getElementById('adminCSVSection');
        if (!container) return;

        container.innerHTML = `
            <div class="admin-csv-zone" id="csvDropZone">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="1.5">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                </svg>
                <p>Drag & drop CSV file here or <label for="csvFileInput" style="color:#a78bfa;cursor:pointer;text-decoration:underline;">browse</label></p>
                <input type="file" id="csvFileInput" accept=".csv" style="display:none;" onchange="adminPanel.handleCSVFile(this.files[0])">
                <small>Required columns: employee_id, name, email. Optional: department, designation, reporting_manager_email, role</small>
            </div>
            <div id="csvPreview" style="display:none;"></div>
        `;

        // Drag and drop
        const zone = document.getElementById('csvDropZone');
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('admin-csv-zone--dragover'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('admin-csv-zone--dragover'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('admin-csv-zone--dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.name.endsWith('.csv')) {
                handleCSVFile(file);
            }
        });
    }

    function handleCSVFile(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const csvText = e.target.result;
            const parsed = parseCSV(csvText);

            if (parsed.length === 0) {
                window.expenseTracker?.showNotification('CSV is empty or invalid');
                return;
            }

            renderCSVPreview(parsed);
        };
        reader.readAsText(file);
    }

    function parseCSV(text) {
        const lines = text.trim().split('\n');
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
        const rows = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/['"]/g, ''));
            if (values.length < headers.length) continue;

            const row = {};
            headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

            // Validate required fields
            if (row.employee_id && row.name && row.email) {
                rows.push(row);
            }
        }

        return rows;
    }

    function renderCSVPreview(data) {
        const preview = document.getElementById('csvPreview');
        if (!preview) return;

        const rows = data.slice(0, 10).map(emp => `
            <tr>
                <td>${sanitize(emp.employee_id)}</td>
                <td>${sanitize(emp.name)}</td>
                <td>${sanitize(emp.email)}</td>
                <td>${sanitize(emp.department || '-')}</td>
                <td>${sanitize(emp.designation || '-')}</td>
                <td>${sanitize(emp.role || 'employee')}</td>
            </tr>
        `).join('');

        preview.style.display = 'block';
        preview.innerHTML = `
            <div class="admin-csv-preview">
                <div class="admin-csv-preview__header">
                    <h4>Preview (${data.length} employees)</h4>
                    ${data.length > 10 ? `<small>Showing first 10 of ${data.length}</small>` : ''}
                </div>
                <div class="admin-table-wrap">
                    <table class="admin-table admin-table--compact">
                        <thead>
                            <tr><th>Emp ID</th><th>Name</th><th>Email</th><th>Department</th><th>Designation</th><th>Role</th></tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                <div class="admin-csv-preview__actions">
                    <button class="admin-btn admin-btn--secondary" onclick="adminPanel.cancelImport()">Cancel</button>
                    <button class="admin-btn admin-btn--primary" id="confirmImportBtn" onclick="adminPanel.confirmImport()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                        Import ${data.length} Employees
                    </button>
                </div>
            </div>
        `;

        // Store parsed data for import
        preview._parsedData = data;
    }

    function cancelImport() {
        const preview = document.getElementById('csvPreview');
        if (preview) {
            preview.style.display = 'none';
            preview.innerHTML = '';
        }
    }

    async function confirmImport() {
        const preview = document.getElementById('csvPreview');
        if (!preview?._parsedData || !organization) return;

        const data = preview._parsedData;
        const btn = document.getElementById('confirmImportBtn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Importing...';
        }

        try {
            const result = await api.importEmployees(organization.id, data);
            window.expenseTracker?.showNotification(`Imported ${result.imported} employees`);
            await api.logActivity?.('employees_imported', `Imported ${result.imported} employees from CSV`);

            cancelImport();
            await loadEmployees();
        } catch (error) {
            window.expenseTracker?.showNotification('Import failed: ' + error.message);
            if (btn) {
                btn.disabled = false;
                btn.textContent = `Import ${data.length} Employees`;
            }
        }
    }

    // ==================== Role & Status Actions ====================

    async function changeRole(selectEl) {
        const id = selectEl.dataset.id;
        const newRole = selectEl.value;
        const currentRole = selectEl.dataset.current;

        if (newRole === currentRole) return;

        try {
            await api.updateEmployeeWhitelist(id, { role: newRole });

            // Also update the profile if they've already signed up
            const emp = employees.find(e => e.id === id);
            if (emp) {
                // Find their profile by email and update role
                const supabase = window.supabaseClient?.get();
                if (supabase) {
                    await supabase
                        .from('profiles')
                        .update({ role: newRole })
                        .eq('email', emp.email)
                        .eq('organization_id', organization.id);
                }
            }

            selectEl.dataset.current = newRole;
            window.expenseTracker?.showNotification(`Role updated to ${newRole}`);
            await loadEmployees();
        } catch (error) {
            selectEl.value = currentRole;
            window.expenseTracker?.showNotification('Failed: ' + error.message);
        }
    }

    async function toggleActive(id, currentlyActive) {
        try {
            await api.updateEmployeeWhitelist(id, { is_active: !currentlyActive });
            window.expenseTracker?.showNotification(currentlyActive ? 'Employee deactivated' : 'Employee activated');
            await loadEmployees();
        } catch (error) {
            window.expenseTracker?.showNotification('Failed: ' + error.message);
        }
    }

    // ==================== Panel Open/Close ====================

    function open() {
        if (!isAdmin()) {
            window.expenseTracker?.showNotification('Admin access required');
            return;
        }

        const overlay = document.getElementById('adminPanelOverlay');
        if (!overlay) return;

        overlay.classList.add('active');
        isOpen = true;
        document.body.classList.add('modal-open');

        initOrganization();
        renderCSVImport();
    }

    function close() {
        const overlay = document.getElementById('adminPanelOverlay');
        if (!overlay) return;

        overlay.classList.remove('active');
        isOpen = false;
        document.body.classList.remove('modal-open');
    }

    // Keyboard: Escape to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) close();
    });

    return {
        open,
        close,
        handleCSVFile,
        cancelImport,
        confirmImport,
        changeRole,
        toggleActive
    };
})();

window.adminPanel = adminPanel;
