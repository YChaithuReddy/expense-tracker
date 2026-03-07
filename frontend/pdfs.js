/**
 * PDF Library Page Logic
 * Handles upload, gallery, Kodo submit, Email submit, delete
 */

const pdfLibrary = (() => {
    'use strict';

    // ---- State ----
    let pendingFile = null;         // File awaiting metadata confirmation
    let pendingPageCount = 0;
    let activePdfRow = null;        // DB row for Kodo/Email/Delete actions
    let kodoConfig = null;          // { checkers, categories } from Edge Function
    let cachedRows = [];            // Gallery rows cached to avoid redundant API calls
    let _previousFocus = null;      // Element focused before library opened (restored on close)

    // ---- Init ----
    function init() {
        setupUploadZone();
    }

    // ---- Library Modal Open/Close ----
    function openLibrary() {
        const overlay = document.getElementById('pdfLibraryModal');
        if (!overlay) return;

        // Save current focus so we can restore it on close (B1)
        _previousFocus = document.activeElement;

        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Focus the close button immediately (B1)
        const closeBtn = overlay.querySelector('.pdfs-library-close');
        if (closeBtn) closeBtn.focus();

        // Attach the focus-trap + Escape keydown listener (B1)
        overlay.addEventListener('keydown', _handleLibraryKeydown);

        loadGallery();
    }

    function closeLibrary() {
        const overlay = document.getElementById('pdfLibraryModal');
        if (!overlay) return;
        overlay.classList.remove('active');
        document.body.style.overflow = '';

        // Remove the focus-trap listener (B1)
        overlay.removeEventListener('keydown', _handleLibraryKeydown);

        // Restore focus to the element that opened the modal (B1)
        if (_previousFocus && typeof _previousFocus.focus === 'function') {
            _previousFocus.focus();
        }
        _previousFocus = null;
    }

    // Focus trap + Escape handler for #pdfLibraryModal (B1)
    function _handleLibraryKeydown(e) {
        const overlay = document.getElementById('pdfLibraryModal');
        if (!overlay) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            closeLibrary();
            return;
        }

        if (e.key !== 'Tab') return;

        const focusable = Array.from(
            overlay.querySelectorAll(
                'button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
        ).filter(el => !el.closest('.pdfs-modal-overlay:not(.active)'));

        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    function sanitize(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // ---- Gallery ----
    async function loadGallery() {
        const gallery = document.getElementById('pdfGallery');
        gallery.innerHTML = `<div class="pdfs-loading"><div class="pdfs-loading__spinner"></div><span>Loading PDFs...</span></div>`;

        try {
            const rows = await window.api.listReimbursementPdfs();
            cachedRows = rows;
            renderGallery(rows);
        } catch (err) {
            console.error('Load gallery error:', err);
            gallery.innerHTML = `<div class="pdfs-empty"><div class="pdfs-empty__icon">⚠️</div><div class="pdfs-empty__title">Failed to load PDFs</div><div class="pdfs-empty__hint">${sanitize(err.message)}</div></div>`;
        }
    }

    function renderGallery(rows) {
        const gallery = document.getElementById('pdfGallery');
        const countBadge = document.getElementById('pdfCount');
        const sizeBadge = document.getElementById('pdfTotalSize');
        countBadge.textContent = rows.length;

        // Calculate total size
        const totalBytes = rows.reduce((s, r) => s + (r.file_size || 0), 0);
        sizeBadge.textContent = formatFileSize(totalBytes);

        if (rows.length === 0) {
            gallery.innerHTML = `
                <div class="pdfs-empty">
                    <div class="pdfs-empty__icon">📁</div>
                    <div class="pdfs-empty__title">No files yet</div>
                    <div class="pdfs-empty__hint">Upload your bills PDF to submit reimbursements in one click.</div>
                    <button class="pdfs-empty__cta" onclick="document.getElementById('pdfFileInput').click()" aria-label="Upload your first PDF">Upload PDF</button>
                </div>`;
            return;
        }

        gallery.innerHTML = rows.map(row => renderRow(row)).join('');
    }

    function renderRow(row) {
        const escapedId = sanitize(row.id);
        const escapedName = sanitize(row.filename);
        const size = formatFileSize(row.file_size || 0);
        const createdAt = fmtDate(row.created_at);
        const pages = row.page_count > 1 ? `${row.page_count} pg` : '1 pg';
        const amount = row.total_amount != null
            ? `₹${Number(row.total_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
            : '';
        const sourceIcon = row.source === 'generated'
            ? `<svg class="pdf-row__icon pdf-row__icon--generated" width="32" height="32" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="14" height="18" rx="2" stroke="currentColor" stroke-width="1.5" fill="rgba(16,185,129,0.1)"/><path d="M9 3V7H3" stroke="currentColor" stroke-width="1.5"/><rect x="6" y="11" width="8" height="1.5" rx=".75" fill="currentColor" opacity=".4"/><rect x="6" y="14" width="6" height="1.5" rx=".75" fill="currentColor" opacity=".3"/></svg>`
            : `<svg class="pdf-row__icon pdf-row__icon--uploaded" width="32" height="32" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="14" height="18" rx="2" stroke="currentColor" stroke-width="1.5" fill="rgba(0,212,255,0.1)"/><path d="M9 3V7H3" stroke="currentColor" stroke-width="1.5"/><rect x="6" y="11" width="8" height="1.5" rx=".75" fill="currentColor" opacity=".4"/><rect x="6" y="14" width="6" height="1.5" rx=".75" fill="currentColor" opacity=".3"/></svg>`;

        return `
            <div class="pdf-row" data-id="${escapedId}" data-name="${escapedName.toLowerCase()}">
                ${sourceIcon}
                <div class="pdf-row__info">
                    <div class="pdf-row__name" title="${escapedName}">${escapedName}</div>
                    <div class="pdf-row__meta">${size} &bull; ${pages}${amount ? ` &bull; ${sanitize(amount)}` : ''} &bull; ${sanitize(createdAt)}</div>
                </div>
                <div class="pdf-row__actions">
                    <button class="pdf-row-btn pdf-row-btn--kodo" onclick="pdfLibrary.openKodoModal('${escapedId}')" title="Submit to Kodo" aria-label="Submit to Kodo">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a4 4 0 00-8 0v2"/><circle cx="12" cy="14" r="1.5"/></svg>
                    </button>
                    <button class="pdf-row-btn pdf-row-btn--email" onclick="pdfLibrary.openEmailModal('${escapedId}')" title="Email to Accounts" aria-label="Email to Accounts">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    </button>
                    <button class="pdf-row-btn pdf-row-btn--download" onclick="pdfLibrary.downloadPdf('${escapedId}')" title="Download" aria-label="Download PDF">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                    <button class="pdf-row-btn pdf-row-btn--delete" onclick="pdfLibrary.openDeleteModal('${escapedId}')" title="Delete" aria-label="Delete PDF">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                </div>
            </div>`;
    }

    function filterFiles(query) {
        const q = (query || '').toLowerCase().trim();
        const rows = document.querySelectorAll('.pdf-row');
        rows.forEach(row => {
            const name = row.getAttribute('data-name') || '';
            row.style.display = !q || name.includes(q) ? '' : 'none';
        });
    }

    function fmtDate(dateStr) {
        if (!dateStr) return '';
        try {
            return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch {
            return dateStr;
        }
    }

    // ---- Upload Zone ----
    function setupUploadZone() {
        const zone = document.getElementById('uploadZone');
        const input = document.getElementById('pdfFileInput');

        zone.addEventListener('dragover', e => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
            if (files.length) handleFileSelected(files[0]);
            else showToast('Please drop a PDF file', 'error');
        });

        input.addEventListener('change', () => {
            if (input.files.length) handleFileSelected(input.files[0]);
            input.value = ''; // reset so same file can be re-selected
        });

        // Keyboard operability for the upload zone (H4)
        zone.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                input.click();
            }
        });
    }

    async function handleFileSelected(file) {
        if (!file.type.includes('pdf') && !file.name.endsWith('.pdf')) {
            showToast('Only PDF files are supported', 'error');
            return;
        }

        pendingFile = file;
        pendingPageCount = 1;

        // Detect page count via pdf-lib
        try {
            const ab = await file.arrayBuffer();
            if (typeof PDFLib !== 'undefined') {
                const doc = await PDFLib.PDFDocument.load(ab, { ignoreEncryption: true });
                pendingPageCount = doc.getPageCount();
            }
        } catch (e) {
            console.warn('Could not read page count:', e);
        }

        // Show metadata modal
        const fileInfo = document.getElementById('metaFileInfo');
        fileInfo.textContent = `📄 ${file.name} — ${pendingPageCount} page${pendingPageCount !== 1 ? 's' : ''}, ${formatFileSize(file.size)}`;

        // Set default date range to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('metaDateTo').value = today;

        openModal('uploadMetaModal');
    }

    function cancelUpload() {
        pendingFile = null;
        closeModal('uploadMetaModal');
        document.getElementById('metaAmount').value = '';
        document.getElementById('metaDateFrom').value = '';
        document.getElementById('metaDateTo').value = '';
        document.getElementById('metaPurpose').value = '';
    }

    async function confirmUpload() {
        if (!pendingFile) return;

        const amount = parseFloat(document.getElementById('metaAmount').value);
        if (!amount || isNaN(amount) || amount <= 0) {
            showToast('Please enter the total amount', 'error');
            document.getElementById('metaAmount').focus();
            return;
        }

        const dateFrom = document.getElementById('metaDateFrom').value || null;
        const dateTo = document.getElementById('metaDateTo').value || null;
        const purpose = document.getElementById('metaPurpose').value.trim() || null;

        const btn = document.getElementById('uploadConfirmBtn');
        btn.disabled = true;
        btn.textContent = 'Uploading...';

        showProgress(10);

        try {
            const supabase = window.supabaseClient.get();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Generate unique storage path
            const ext = 'pdf';
            const uuid = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
            const storagePath = `${user.id}/reimbursement-pdfs/${uuid}.${ext}`;

            showProgress(30);

            // Upload to storage
            const { error: uploadError } = await supabase.storage
                .from('expense-bills')
                .upload(storagePath, pendingFile, { cacheControl: '3600', upsert: false });

            if (uploadError) throw uploadError;
            showProgress(70);

            // Save metadata to DB
            await window.api.saveReimbursementPdf({
                storagePath,
                filename: pendingFile.name,
                fileSize: pendingFile.size,
                pageCount: pendingPageCount,
                totalAmount: amount,
                dateFrom,
                dateTo,
                purpose,
                source: 'uploaded'
            });

            showProgress(100);
            closeModal('uploadMetaModal');
            cancelUpload();
            showToast('PDF uploaded successfully ✅', 'success');
            await loadGallery();

        } catch (err) {
            console.error('Upload error:', err);
            showToast('Upload failed: ' + (err.message || 'Unknown error'), 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Upload PDF';
            hideProgress();
        }
    }

    function showProgress(pct) {
        const bar = document.getElementById('uploadProgress');
        const fill = document.getElementById('uploadProgressBar');
        bar.classList.add('active');
        bar.setAttribute('aria-valuenow', pct);
        fill.style.width = pct + '%';
    }
    function hideProgress() {
        setTimeout(() => {
            const bar = document.getElementById('uploadProgress');
            bar.classList.remove('active');
            bar.setAttribute('aria-valuenow', 0);
            document.getElementById('uploadProgressBar').style.width = '0%';
        }, 600);
    }

    // ---- Download ----
    async function downloadPdf(id) {
        const row = await getRowById(id);
        if (!row) return;

        try {
            showToast('Preparing download...', '');
            const supabase = window.supabaseClient.get();
            const { data, error } = await supabase.storage
                .from('expense-bills')
                .download(row.storage_path);

            if (error) throw error;

            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = row.filename;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Download started', 'success');
        } catch (err) {
            showToast('Download failed: ' + err.message, 'error');
        }
    }

    // ---- Kodo Submit (reuses main app's kodoConfirmModal) ----
    async function openKodoModal(id) {
        activePdfRow = await getRowById(id);
        if (!activePdfRow) return;

        const modal = document.getElementById('kodoConfirmModal');
        const closeBtn = document.getElementById('closeKodoConfirm');
        const cancelBtn = document.getElementById('kodoCancelSubmit');
        const confirmBtn = document.getElementById('kodoConfirmSubmit');
        const summaryDiv = document.getElementById('kodoConfirmSummary');
        const commentInput = document.getElementById('kodoConfirmComment');
        const tracker = window.expenseTracker;
        const kodo = window.kodoService;

        if (!modal || !kodo || !tracker) {
            showToast('Kodo service not available', 'error');
            return;
        }

        const totalAmount = parseFloat(activePdfRow.total_amount) || 0;
        const pages = activePdfRow.page_count > 1 ? `${activePdfRow.page_count} pages` : '1 page';
        const dateFrom = activePdfRow.date_from || '';
        const dateTo = activePdfRow.date_to || '';
        const dateRange = dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : (dateFrom || dateTo || 'N/A');

        // Build summary — same style as main app
        summaryDiv.innerHTML = `
            <div class="kodo-summary-row">
                <span class="kodo-summary-label">File</span>
                <span class="kodo-summary-value">${sanitize(activePdfRow.filename)}</span>
            </div>
            <div class="kodo-summary-row kodo-summary-total">
                <span class="kodo-summary-label">Total Amount</span>
                <span class="kodo-summary-value">${tracker.formatAmount(totalAmount)}</span>
            </div>
            <div class="kodo-summary-row">
                <span class="kodo-summary-label">Pages</span>
                <span class="kodo-summary-value">${pages}</span>
            </div>
        `;

        // Set default comment
        commentInput.value = activePdfRow.purpose || 'Reimbursement claim from PDF Library';

        // Load Kodo config
        tracker.showLoading('Loading Kodo config...', 'Logging into Kodo & fetching checkers/categories');
        try {
            kodo.config = null;
            const config = await kodo.getKodoConfig();
            tracker.populateKodoDropdowns(config, 'kodoConfirmChecker', 'kodoConfirmCategory');

            if (!config.checkers?.length || !config.categories?.length) {
                tracker.hideLoading();
                const missing = [];
                if (!config.checkers?.length) missing.push('checkers');
                if (!config.categories?.length) missing.push('categories');
                tracker.showError('Could not fetch ' + missing.join(' and ') + ' from Kodo.\n\nPlease check your Kodo credentials in Settings.', 'Kodo Config Error');
                return;
            }
        } catch (err) {
            tracker.hideLoading();
            if (err.needsReauth || (err.message && err.message.includes('OTP_REQUIRED'))) {
                tracker.showError('Your Kodo session has expired.\n\nPlease go to Kodo Settings and click "Test Connection" to re-authenticate with OTP.', 'Kodo Re-authentication Required');
            } else {
                tracker.showError('Failed to load Kodo config:\n\n' + (err.message || 'Please check your credentials.'), 'Kodo Error');
            }
            return;
        }
        tracker.hideLoading();

        const closeModal = () => { modal.style.display = 'none'; activePdfRow = null; };
        closeBtn.onclick = closeModal;
        cancelBtn.onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };

        confirmBtn.onclick = async () => {
            const checkerSelect = document.getElementById('kodoConfirmChecker');
            const categorySelect = document.getElementById('kodoConfirmCategory');

            if (!checkerSelect.value) { tracker.showNotification('Please select a checker (approver)'); return; }
            if (!categorySelect.value) { tracker.showNotification('Please select a category'); return; }

            closeModal();
            await submitToKodo({
                totalAmount,
                checkerId: checkerSelect.value,
                checkerName: checkerSelect.options[checkerSelect.selectedIndex].text,
                categoryId: categorySelect.value,
                comment: commentInput.value,
                billDate: activePdfRow?.date_from || new Date().toISOString().split('T')[0],
            });
        };

        modal.style.display = 'flex';
    }

    function closeKodoModal() {
        activePdfRow = null;
        const modal = document.getElementById('kodoConfirmModal');
        if (modal) modal.style.display = 'none';
    }

    async function submitToKodo(details) {
        const tracker = window.expenseTracker;
        const kodo = window.kodoService;
        const row = activePdfRow;

        if (!row) return;

        try {
            // Download PDF bytes from storage
            tracker.showLoading('Downloading PDF...', 'Fetching from storage');
            const supabase = window.supabaseClient.get();
            const { data: blob, error: dlError } = await supabase.storage
                .from('expense-bills')
                .download(row.storage_path);
            if (dlError) throw dlError;

            const pdfBytes = new Uint8Array(await blob.arrayBuffer());

            // Submit via kodoService (same as main app)
            tracker.showLoading('Submitting to Kodo...', `Uploading ${tracker.formatAmount(details.totalAmount)} claim to ${details.checkerName}`);

            await kodo.submitToKodo(pdfBytes, {
                totalAmount: details.totalAmount,
                checkerId: details.checkerId,
                categoryId: details.categoryId,
                comment: details.comment,
                billDate: details.billDate,
            });

            tracker.hideLoading();
            tracker.showNotification(`Reimbursement claim ${tracker.formatAmount(details.totalAmount)} submitted to ${details.checkerName} for review`);
            window.api?.logActivity?.('kodo_submitted', `PDF Library: Submitted ₹${Math.round(details.totalAmount)} to Kodo — checker: ${details.checkerName}`, { amount: details.totalAmount, checker: details.checkerName });
        } catch (err) {
            tracker.hideLoading();
            console.error('Kodo submit error:', err);
            tracker.showNotification('Kodo submission failed: ' + err.message);
        }

        activePdfRow = null;
    }

    // ---- Email Submit ----
    async function openEmailModal(id) {
        activePdfRow = await getRowById(id);
        if (!activePdfRow) return;

        const row = activePdfRow;
        const amount = row.total_amount != null
            ? `₹${Number(row.total_amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
            : '';

        const periodStr = row.date_from || row.date_to
            ? [row.date_from, row.date_to].filter(Boolean).map(fmtDate).join(' – ')
            : '';

        document.getElementById('emailTo').value = '';
        document.getElementById('emailSubject').value =
            `Reimbursement Request${amount ? ' – ' + amount : ''}${periodStr ? ' (' + periodStr + ')' : ''}`;
        document.getElementById('emailBody').value =
            `Hi Team,\n\nPlease find attached my reimbursement request${periodStr ? ' for the period ' + periodStr : ''}.\n\n` +
            `${amount ? 'Total Amount: ' + amount + '\n' : ''}` +
            `${row.purpose ? 'Purpose: ' + row.purpose + '\n' : ''}` +
            `\nKindly process at the earliest.\n\nThank you.`;

        openModal('emailModal');
    }

    function closeEmailModal() {
        activePdfRow = null;
        closeModal('emailModal');
    }

    async function sendEmail() {
        if (!activePdfRow) return;

        const to = document.getElementById('emailTo').value.trim();
        const subject = document.getElementById('emailSubject').value.trim();
        const body = document.getElementById('emailBody').value.trim();

        if (!to) {
            showToast('Please enter a recipient email', 'error');
            document.getElementById('emailTo').focus();
            return;
        }

        const btn = document.getElementById('emailSendBtn');
        btn.disabled = true;
        btn.textContent = 'Sending...';

        try {
            // Download PDF bytes
            const supabase = window.supabaseClient.get();
            const { data: blob, error: dlError } = await supabase.storage
                .from('expense-bills')
                .download(activePdfRow.storage_path);
            if (dlError) throw dlError;

            const ab = await blob.arrayBuffer();
            const pdfBase64 = arrayBufferToBase64(ab);

            // Get current user for sender info
            const user = window.auth?.getCurrentUser?.() || JSON.parse(localStorage.getItem('user') || 'null');

            const { data, error } = await supabase.functions.invoke('send-email', {
                body: {
                    to: [to],
                    subject,
                    body: body.replace(/\n/g, '<br>'),
                    pdfBase64,
                    fileName: activePdfRow.filename,
                    replyTo: user?.email || '',
                    senderName: user?.name || ''
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            closeEmailModal();
            showToast('✅ Email sent successfully!', 'success');
        } catch (err) {
            console.error('Email send error:', err);
            showToast('Email failed: ' + (err.message || 'Unknown error'), 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Send Email';
        }
    }

    // ---- Delete ----
    async function openDeleteModal(id) {
        activePdfRow = await getRowById(id);
        if (!activePdfRow) return;
        document.getElementById('deleteFileName').textContent = activePdfRow.filename;
        // Reset checkbox, disable delete button, and show hint each time modal opens (M3)
        const checkbox = document.getElementById('deleteConfirmCheck');
        const deleteBtn = document.getElementById('deleteConfirmBtn');
        const hint = document.getElementById('deleteHint');
        if (checkbox) checkbox.checked = false;
        if (deleteBtn) deleteBtn.disabled = true;
        if (hint) hint.style.display = '';
        openModal('deleteModal');
    }

    function closeDeleteModal() {
        activePdfRow = null;
        // Reset checkbox state and restore hint on close (M3)
        const checkbox = document.getElementById('deleteConfirmCheck');
        const deleteBtn = document.getElementById('deleteConfirmBtn');
        const hint = document.getElementById('deleteHint');
        if (checkbox) checkbox.checked = false;
        if (deleteBtn) deleteBtn.disabled = true;
        if (hint) hint.style.display = '';
        closeModal('deleteModal');
    }

    function onDeleteCheckChange(checkbox) {
        const deleteBtn = document.getElementById('deleteConfirmBtn');
        if (deleteBtn) deleteBtn.disabled = !checkbox.checked;
        // Hide hint when checkbox is checked; show it when unchecked (M3)
        const hint = document.getElementById('deleteHint');
        if (hint) hint.style.display = checkbox.checked ? 'none' : '';
    }

    async function confirmDelete() {
        if (!activePdfRow) return;

        const btn = document.getElementById('deleteConfirmBtn');
        btn.disabled = true;
        btn.textContent = 'Deleting...';

        try {
            await window.api.deleteReimbursementPdf(activePdfRow.id, activePdfRow.storage_path);
            closeDeleteModal();
            showToast('PDF deleted', 'success');
            await loadGallery();
        } catch (err) {
            showToast('Delete failed: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Delete';
        }
    }

    // ---- Row Lookup ----
    // Synchronous lookup against cachedRows populated by loadGallery (M5)
    async function getRowById(id) {
        try {
            return cachedRows.find(r => r.id === id) || null;
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
            return null;
        }
    }

    // ---- Modal Helpers ----
    function openModal(id) {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('active');
            // Close on overlay click
            el.onclick = e => { if (e.target === el) el.classList.remove('active'); };
        }
    }
    function closeModal(id) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    }

    // ---- Toast ----
    let toastTimer = null;
    function showToast(message, type = '') {
        const toast = document.getElementById('pdfToast');
        toast.textContent = message;
        toast.className = 'pdfs-toast' + (type ? ` pdfs-toast--${type}` : '');
        toast.classList.add('show');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
    }

    // ---- Utils ----
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    // ---- Public API ----
    return {
        init,
        openLibrary,
        closeLibrary,
        cancelUpload,
        confirmUpload,
        downloadPdf,
        openKodoModal,
        closeKodoModal,
        submitToKodo,
        openEmailModal,
        closeEmailModal,
        sendEmail,
        openDeleteModal,
        closeDeleteModal,
        confirmDelete,
        onDeleteCheckChange,
        filterFiles
    };
})();

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', pdfLibrary.init);
} else {
    pdfLibrary.init();
}
