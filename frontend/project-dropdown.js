/**
 * Project Dropdown — Searchable typeahead for project selection
 * Company mode: shows searchable dropdown from projects table
 * Personal mode: shows free-text input (original vendor field)
 */
const projectDropdown = (() => {
    'use strict';

    let projects = [];
    let filteredProjects = [];
    let selectedProject = null;
    let isOpen = false;
    let highlightIndex = -1;
    let initialized = false;

    // ==================== Initialization ====================

    async function init() {
        if (initialized) return;
        initialized = true;

        if (!isCompanyMode()) {
            // Personal mode — keep original vendor text input visible
            showPersonalMode();
            return;
        }

        // Company mode — setup searchable dropdown
        await loadProjects();
        setupDropdown();
    }

    function showPersonalMode() {
        const container = document.getElementById('projectDropdownContainer');
        if (!container) return;
        // In personal mode, just show the regular vendor input
        container.style.display = 'none';
        const vendorInput = document.getElementById('vendor');
        if (vendorInput) vendorInput.closest('.form-group').style.display = '';
    }

    async function loadProjects() {
        const orgId = getOrganizationId();
        if (!orgId) return;

        try {
            projects = await api.getProjects(orgId, 'active');
        } catch (e) {
            console.error('Failed to load projects:', e);
            projects = [];
        }
    }

    async function refresh() {
        await loadProjects();
    }

    // ==================== Dropdown Setup ====================

    function setupDropdown() {
        const container = document.getElementById('projectDropdownContainer');
        if (!container) return;

        // Hide original vendor input
        const vendorInput = document.getElementById('vendor');
        if (vendorInput) vendorInput.closest('.form-group').style.display = 'none';

        container.style.display = '';
        container.innerHTML = `
            <div class="project-dd">
                <div class="project-dd__input-wrap">
                    <svg class="project-dd__search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" class="project-dd__input" id="projectSearchInput"
                           placeholder="Search project by name or code..."
                           autocomplete="off">
                    <button type="button" class="project-dd__clear" id="projectClearBtn" style="display:none;" title="Clear selection">&times;</button>
                </div>
                <div class="project-dd__list" id="projectDropdownList" style="display:none;"></div>
                <input type="hidden" id="projectId" name="projectId" value="">
            </div>
        `;

        const input = document.getElementById('projectSearchInput');
        const list = document.getElementById('projectDropdownList');
        const clearBtn = document.getElementById('projectClearBtn');

        // Input events
        input.addEventListener('focus', () => openList());
        input.addEventListener('input', () => {
            filterProjects(input.value);
            openList();
        });

        // Keyboard navigation
        input.addEventListener('keydown', (e) => {
            if (!isOpen) {
                if (e.key === 'ArrowDown' || e.key === 'Enter') { openList(); e.preventDefault(); }
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                highlightIndex = Math.min(highlightIndex + 1, filteredProjects.length - 1);
                updateHighlight();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                highlightIndex = Math.max(highlightIndex - 1, 0);
                updateHighlight();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (highlightIndex >= 0 && filteredProjects[highlightIndex]) {
                    selectProject(filteredProjects[highlightIndex]);
                }
            } else if (e.key === 'Escape') {
                closeList();
            }
        });

        // Clear button
        clearBtn.addEventListener('click', () => {
            clearSelection();
            input.focus();
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.project-dd')) {
                closeList();
            }
        });

        // Also set vendor hidden input for backward compat
        // If project is selected, vendor = project_name
    }

    // ==================== Filtering & Rendering ====================

    function filterProjects(query) {
        const q = (query || '').toLowerCase().trim();
        if (!q) {
            filteredProjects = [...projects];
        } else {
            filteredProjects = projects.filter(p =>
                p.project_code.toLowerCase().includes(q) ||
                p.project_name.toLowerCase().includes(q) ||
                (p.client_name && p.client_name.toLowerCase().includes(q))
            );
        }
        highlightIndex = filteredProjects.length > 0 ? 0 : -1;
        renderList();
    }

    function renderList() {
        const list = document.getElementById('projectDropdownList');
        if (!list) return;

        if (filteredProjects.length === 0) {
            const canCreate = hasApprovalAccess();
            list.innerHTML = `
                <div class="project-dd__empty">
                    <p>No projects found</p>
                    ${canCreate ? '<button type="button" class="project-dd__create-btn" onclick="projectDropdown.openCreateForm()">+ Create New Project</button>' : ''}
                </div>
            `;
            return;
        }

        list.innerHTML = filteredProjects.map((p, idx) => {
            const statusIcon = p.status === 'active' ? '●' : p.status === 'on_hold' ? '◐' : '○';
            const statusClass = `project-dd__status--${p.status}`;
            const isHighlighted = idx === highlightIndex ? 'project-dd__item--highlighted' : '';
            const isSelected = selectedProject?.id === p.id ? 'project-dd__item--selected' : '';

            return `
                <div class="project-dd__item ${isHighlighted} ${isSelected}"
                     data-index="${idx}"
                     onmouseenter="projectDropdown.setHighlight(${idx})"
                     onclick="projectDropdown.selectByIndex(${idx})">
                    <div class="project-dd__item-main">
                        <span class="project-dd__code">${sanitize(p.project_code)}</span>
                        <span class="project-dd__name">${sanitize(p.project_name)}</span>
                    </div>
                    <div class="project-dd__item-meta">
                        ${p.client_name ? `<span class="project-dd__client">${sanitize(p.client_name)}</span>` : ''}
                        <span class="project-dd__status ${statusClass}">${statusIcon} ${p.status}</span>
                        ${p.budget ? `<span class="project-dd__budget">₹${Number(p.budget).toLocaleString('en-IN')}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        // Add "Create New" button at bottom for privileged users
        if (hasApprovalAccess()) {
            list.innerHTML += `
                <div class="project-dd__footer">
                    <button type="button" class="project-dd__create-btn" onclick="projectDropdown.openCreateForm()">+ Create New Project</button>
                </div>
            `;
        }
    }

    function sanitize(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ==================== Selection ====================

    function selectProject(project) {
        selectedProject = project;
        const input = document.getElementById('projectSearchInput');
        const hiddenInput = document.getElementById('projectId');
        const vendorInput = document.getElementById('vendor');
        const clearBtn = document.getElementById('projectClearBtn');

        if (input) {
            input.value = `${project.project_code} — ${project.project_name}`;
            input.classList.add('project-dd__input--selected');
        }
        if (hiddenInput) hiddenInput.value = project.id;
        // Also set vendor for backward compat (advance auto-linking uses vendor)
        if (vendorInput) vendorInput.value = project.project_name;
        if (clearBtn) clearBtn.style.display = 'flex';

        closeList();

        // Trigger vendor input event for advance indicator update
        vendorInput?.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function selectByIndex(idx) {
        if (filteredProjects[idx]) {
            selectProject(filteredProjects[idx]);
        }
    }

    function clearSelection() {
        selectedProject = null;
        const input = document.getElementById('projectSearchInput');
        const hiddenInput = document.getElementById('projectId');
        const vendorInput = document.getElementById('vendor');
        const clearBtn = document.getElementById('projectClearBtn');

        if (input) {
            input.value = '';
            input.classList.remove('project-dd__input--selected');
        }
        if (hiddenInput) hiddenInput.value = '';
        if (vendorInput) vendorInput.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
    }

    function getSelectedProject() {
        return selectedProject;
    }

    // ==================== Open/Close ====================

    function openList() {
        const list = document.getElementById('projectDropdownList');
        if (!list) return;

        filterProjects(document.getElementById('projectSearchInput')?.value || '');
        list.style.display = 'block';
        isOpen = true;
    }

    function closeList() {
        const list = document.getElementById('projectDropdownList');
        if (list) list.style.display = 'none';
        isOpen = false;
        highlightIndex = -1;
    }

    function setHighlight(idx) {
        highlightIndex = idx;
        updateHighlight();
    }

    function updateHighlight() {
        const items = document.querySelectorAll('.project-dd__item');
        items.forEach((item, i) => {
            item.classList.toggle('project-dd__item--highlighted', i === highlightIndex);
        });
        // Scroll highlighted item into view
        if (items[highlightIndex]) {
            items[highlightIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    // ==================== Create Project Modal ====================

    function openCreateForm() {
        closeList();

        const overlay = document.createElement('div');
        overlay.id = 'projectCreateOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);';

        overlay.innerHTML = `
            <div class="project-create-modal">
                <h3>Create New Project</h3>
                <p style="color:#5a6180;font-size:0.82rem;margin:0 0 16px;">Project code will be auto-generated</p>
                <form id="quickProjectForm">
                    <div class="admin-form-group">
                        <label>Project Name *</label>
                        <input type="text" id="qpName" placeholder="e.g., Highway Bridge Construction" required>
                    </div>
                    <div class="admin-form-group">
                        <label>Client Name</label>
                        <input type="text" id="qpClient" placeholder="e.g., NHAI">
                    </div>
                    <div style="display:flex;gap:12px;">
                        <div class="admin-form-group" style="flex:1;">
                            <label>Budget (₹)</label>
                            <input type="number" id="qpBudget" placeholder="0.00" step="0.01">
                        </div>
                        <div class="admin-form-group" style="flex:1;">
                            <label>Status</label>
                            <select id="qpStatus" class="admin-role-select" style="width:100%;padding:10px;">
                                <option value="active">Active</option>
                                <option value="on_hold">On Hold</option>
                            </select>
                        </div>
                    </div>
                    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
                        <button type="button" class="admin-btn admin-btn--secondary" onclick="document.getElementById('projectCreateOverlay').remove()">Cancel</button>
                        <button type="submit" class="admin-btn admin-btn--primary" id="qpSubmitBtn">Create Project</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(overlay);
        document.getElementById('qpName').focus();

        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        document.getElementById('quickProjectForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('qpSubmitBtn');
            btn.disabled = true;
            btn.textContent = 'Creating...';

            try {
                const orgId = getOrganizationId();
                const result = await api.createProject(orgId, {
                    project_name: document.getElementById('qpName').value.trim(),
                    client_name: document.getElementById('qpClient').value.trim() || null,
                    budget: document.getElementById('qpBudget').value || null,
                    status: document.getElementById('qpStatus').value
                });

                overlay.remove();
                await loadProjects();
                selectProject(result.data);
                window.expenseTracker?.showNotification(`Project ${result.data.project_code} created`);
                await api.logActivity?.('project_created', `Created project: ${result.data.project_code} — ${result.data.project_name}`);
            } catch (error) {
                window.expenseTracker?.showNotification('Failed: ' + error.message);
                btn.disabled = false;
                btn.textContent = 'Create Project';
            }
        });
    }

    // ==================== Admin: Project List for Management ====================

    function renderProjectManagement(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (projects.length === 0) {
            container.innerHTML = '<div class="admin-empty"><p>No projects yet. Create one from the expense form or here.</p></div>';
            return;
        }

        const rows = projects.map(p => {
            const statusClass = `project-dd__status--${p.status}`;
            return `
                <tr>
                    <td><span class="admin-emp-id">${sanitize(p.project_code)}</span></td>
                    <td>${sanitize(p.project_name)}</td>
                    <td>${sanitize(p.client_name || '-')}</td>
                    <td>${p.budget ? '₹' + Number(p.budget).toLocaleString('en-IN') : '-'}</td>
                    <td>
                        <select class="admin-role-select" data-project-id="${p.id}" onchange="projectDropdown.updateStatus(this)">
                            <option value="active" ${p.status === 'active' ? 'selected' : ''}>Active</option>
                            <option value="on_hold" ${p.status === 'on_hold' ? 'selected' : ''}>On Hold</option>
                            <option value="completed" ${p.status === 'completed' ? 'selected' : ''}>Completed</option>
                            <option value="cancelled" ${p.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                    </td>
                    <td style="font-size:0.75rem;color:#5a6180;">${p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN') : '-'}</td>
                </tr>
            `;
        }).join('');

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <h4 style="color:#a78bfa;margin:0;">Projects (${projects.length})</h4>
                <button type="button" class="admin-btn admin-btn--primary" style="padding:6px 14px;font-size:0.8rem;" onclick="projectDropdown.openCreateForm()">+ New Project</button>
            </div>
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead>
                        <tr><th>Code</th><th>Name</th><th>Client</th><th>Budget</th><th>Status</th><th>Created</th></tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }

    async function updateStatus(selectEl) {
        const projectId = selectEl.dataset.projectId;
        const newStatus = selectEl.value;
        try {
            await api.updateProject(projectId, { status: newStatus });
            await loadProjects();
            window.expenseTracker?.showNotification(`Project status updated to ${newStatus}`);
        } catch (error) {
            window.expenseTracker?.showNotification('Failed: ' + error.message);
        }
    }

    return {
        init,
        refresh,
        selectByIndex,
        setHighlight,
        selectProject,
        clearSelection,
        getSelectedProject,
        openCreateForm,
        renderProjectManagement,
        updateStatus
    };
})();

window.projectDropdown = projectDropdown;
