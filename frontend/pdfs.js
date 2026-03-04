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

    // ---- Init ----
    function init() {
        setupUploadZone();
    }

    // ---- Library Modal Open/Close ----
    function openLibrary() {
        const overlay = document.getElementById('pdfLibraryModal');
        if (!overlay) return;
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        loadGallery();
    }

    function closeLibrary() {
        const overlay = document.getElementById('pdfLibraryModal');
        if (!overlay) return;
        overlay.classList.remove('active');
        document.body.style.overflow = '';
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
            renderGallery(rows);
        } catch (err) {
            console.error('Load gallery error:', err);
            gallery.innerHTML = `<div class="pdfs-empty"><div class="pdfs-empty__icon">⚠️</div><div class="pdfs-empty__title">Failed to load PDFs</div><div class="pdfs-empty__hint">${sanitize(err.message)}</div></div>`;
        }
    }

    function renderGallery(rows) {
        const gallery = document.getElementById('pdfGallery');
        const countBadge = document.getElementById('pdfCount');
        countBadge.textContent = rows.length;

        if (rows.length === 0) {
            gallery.innerHTML = `
                <div class="pdfs-empty">
                    <svg class="pdfs-empty__illustration" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <rect x="14" y="10" width="38" height="50" rx="5" stroke="rgba(0,212,255,0.5)" stroke-width="2" fill="rgba(0,212,255,0.06)"/>
                        <rect x="20" y="22" width="26" height="2.5" rx="1.25" fill="rgba(0,212,255,0.35)"/>
                        <rect x="20" y="30" width="20" height="2.5" rx="1.25" fill="rgba(0,212,255,0.25)"/>
                        <rect x="20" y="38" width="16" height="2.5" rx="1.25" fill="rgba(0,212,255,0.15)"/>
                        <rect x="10" y="18" width="38" height="50" rx="5" stroke="rgba(124,58,237,0.4)" stroke-width="1.5" fill="rgba(124,58,237,0.04)" stroke-dasharray="4 3"/>
                        <circle cx="58" cy="58" r="14" fill="rgba(0,212,255,0.12)" stroke="rgba(0,212,255,0.4)" stroke-width="1.5"/>
                        <line x1="58" y1="52" x2="58" y2="64" stroke="rgba(0,212,255,0.8)" stroke-width="2" stroke-linecap="round"/>
                        <line x1="52" y1="58" x2="64" y2="58" stroke="rgba(0,212,255,0.8)" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <div class="pdfs-empty__title">Your PDF Library is empty</div>
                    <div class="pdfs-empty__hint">Upload your bills PDF to submit reimbursements in one click &mdash; no re-entering data needed.</div>
                    <button class="pdfs-empty__cta" onclick="document.getElementById('pdfFileInput').click()" aria-label="Upload your first PDF">
                        <span aria-hidden="true">📁</span>
                        Upload Your First PDF
                    </button>
                </div>`;
            return;
        }

        gallery.innerHTML = rows.map(row => renderCard(row)).join('');
    }

    function renderCard(row) {
        const amount = row.total_amount != null
            ? `₹${Number(row.total_amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
            : '—';

        const pages = row.page_count > 1 ? `${row.page_count} pages` : '1 page';

        let dateStr = '';
        if (row.date_from || row.date_to) {
            const from = row.date_from ? fmtDate(row.date_from) : '';
            const to = row.date_to ? fmtDate(row.date_to) : '';
            dateStr = from && to ? `${from} – ${to}` : (from || to);
        }
        const createdAt = fmtDate(row.created_at);
        const sourceBadge = row.source === 'generated'
            ? `<span class="pdf-card__source-badge pdf-card__source-badge--generated">Generated</span>`
            : `<span class="pdf-card__source-badge pdf-card__source-badge--uploaded">Uploaded</span>`;

        const escapedId = sanitize(row.id);
        const escapedName = sanitize(row.filename);

        const sourceClass = row.source === 'generated' ? 'pdf-card--generated' : 'pdf-card--uploaded';

        return `
            <div class="pdf-card ${sourceClass}" data-id="${escapedId}">
                <div class="pdf-card__thumb">
                    ${sourceBadge}
                    <span class="pdf-card__page-badge">${sanitize(pages)}</span>
                    <svg class="pdf-card__icon" viewBox="0 0 48 60" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <rect x="2" y="2" width="36" height="46" rx="4" stroke="currentColor" stroke-width="2.5" fill="rgba(0,212,255,0.08)"/>
                        <path d="M10 4 L10 14 L2 14" stroke="currentColor" stroke-width="2" fill="none"/>
                        <rect x="7" y="22" width="24" height="2.5" rx="1.25" fill="currentColor" opacity="0.5"/>
                        <rect x="7" y="29" width="20" height="2.5" rx="1.25" fill="currentColor" opacity="0.5"/>
                        <rect x="7" y="36" width="16" height="2.5" rx="1.25" fill="currentColor" opacity="0.5"/>
                    </svg>
                </div>
                <div class="pdf-card__body">
                    <div class="pdf-card__filename" title="${escapedName}">${escapedName}</div>
                    <div class="pdf-card__amount">${sanitize(amount)}</div>
                    <div class="pdf-card__meta">
                        ${dateStr ? `${sanitize(dateStr)}<br>` : ''}
                        ${sanitize(createdAt)}
                    </div>
                </div>
                <div class="pdf-card__actions">
                    <button class="pdf-action-btn pdf-action-btn--download" onclick="pdfLibrary.downloadPdf('${escapedId}')" title="Download" aria-label="Download PDF">
                        <span aria-hidden="true">⬇️</span>
                        <span class="pdf-action-btn__label">Save</span>
                    </button>
                    <button class="pdf-action-btn pdf-action-btn--kodo" onclick="pdfLibrary.openKodoModal('${escapedId}')" title="Submit to Kodo" aria-label="Submit to Kodo">
                        <span aria-hidden="true">🏢</span>
                        <span class="pdf-action-btn__label">Kodo</span>
                    </button>
                    <button class="pdf-action-btn pdf-action-btn--email" onclick="pdfLibrary.openEmailModal('${escapedId}')" title="Email to Accounts" aria-label="Email to Accounts">
                        <span aria-hidden="true">📧</span>
                        <span class="pdf-action-btn__label">Email</span>
                    </button>
                    <button class="pdf-action-btn pdf-action-btn--delete" onclick="pdfLibrary.openDeleteModal('${escapedId}')" title="Delete" aria-label="Delete PDF">
                        <span aria-hidden="true">🗑️</span>
                        <span class="pdf-action-btn__label">Del</span>
                    </button>
                </div>
            </div>`;
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

    // ---- Kodo Submit ----
    async function openKodoModal(id) {
        activePdfRow = await getRowById(id);
        if (!activePdfRow) return;

        // Pre-fill amount
        document.getElementById('kodoAmount').value = activePdfRow.total_amount || '';
        // Default bill date to today
        document.getElementById('kodoBillDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('kodoComment').value = activePdfRow.purpose || '';

        // Load Kodo config (categories + checkers)
        const categorySelect = document.getElementById('kodoCategory');
        const checkerSelect = document.getElementById('kodoChecker');
        categorySelect.innerHTML = '<option value="">Loading...</option>';
        checkerSelect.innerHTML = '<option value="">Loading...</option>';

        openModal('kodoModal');
        loadKodoConfig(categorySelect, checkerSelect);
    }

    async function loadKodoConfig(categorySelect, checkerSelect) {
        if (kodoConfig) {
            populateKodoSelects(categorySelect, checkerSelect, kodoConfig);
            return;
        }

        try {
            const supabase = window.supabaseClient.get();
            const { data, error } = await supabase.functions.invoke('kodo-submit', {
                body: { action: 'get-config' }
            });
            if (error) throw error;

            kodoConfig = data;
            populateKodoSelects(categorySelect, checkerSelect, data);
        } catch (err) {
            categorySelect.innerHTML = '<option value="">Failed to load</option>';
            checkerSelect.innerHTML = '<option value="">Failed to load</option>';
            showToast('Could not load Kodo config: ' + err.message, 'error');
        }
    }

    function populateKodoSelects(categorySelect, checkerSelect, config) {
        // Categories
        const categories = config?.categories || config?.expenseCategories || [];
        categorySelect.innerHTML = categories.length
            ? categories.map(c => `<option value="${sanitize(String(c.id))}">${sanitize(c.name)}</option>`).join('')
            : '<option value="">No categories found</option>';

        // Checkers
        const checkers = config?.checkers || config?.approvers || [];
        checkerSelect.innerHTML = checkers.length
            ? checkers.map(c => `<option value="${sanitize(c.id)}">${sanitize(c.name || c.email || c.id)}</option>`).join('')
            : '<option value="">No checkers found</option>';

        // Pre-select defaults from config
        if (config?.defaultCategoryId) categorySelect.value = config.defaultCategoryId;
        if (config?.defaultCheckerId) checkerSelect.value = config.defaultCheckerId;
    }

    function closeKodoModal() {
        activePdfRow = null;
        closeModal('kodoModal');
    }

    async function submitToKodo() {
        if (!activePdfRow) return;

        const amount = parseFloat(document.getElementById('kodoAmount').value);
        const billDate = document.getElementById('kodoBillDate').value;
        const categoryId = document.getElementById('kodoCategory').value;
        const checkerId = document.getElementById('kodoChecker').value;
        const comment = document.getElementById('kodoComment').value.trim();

        if (!amount || isNaN(amount) || amount <= 0) {
            showToast('Please enter the amount', 'error');
            return;
        }
        if (!billDate) {
            showToast('Please enter the bill date', 'error');
            return;
        }

        const btn = document.getElementById('kodoSubmitBtn');
        btn.disabled = true;
        btn.textContent = 'Submitting...';

        try {
            // Download PDF bytes from storage
            const supabase = window.supabaseClient.get();
            const { data: blob, error: dlError } = await supabase.storage
                .from('expense-bills')
                .download(activePdfRow.storage_path);
            if (dlError) throw dlError;

            const arrayBuffer = await blob.arrayBuffer();
            const pdfBase64 = arrayBufferToBase64(arrayBuffer);

            // Call kodo-submit Edge Function
            const { data, error } = await supabase.functions.invoke('kodo-submit', {
                body: {
                    action: 'submit',
                    pdfBase64,
                    fileName: activePdfRow.filename,
                    totalAmount: amount,
                    billDate,
                    categoryId,
                    checkerId,
                    comment
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            closeKodoModal();
            showToast('✅ Submitted to Kodo successfully!', 'success');
        } catch (err) {
            console.error('Kodo submit error:', err);
            showToast('Kodo submit failed: ' + (err.message || 'Unknown error'), 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Submit to Kodo';
        }
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
        // Reset checkbox and disable delete button each time modal opens
        const checkbox = document.getElementById('deleteConfirmCheck');
        const deleteBtn = document.getElementById('deleteConfirmBtn');
        if (checkbox) checkbox.checked = false;
        if (deleteBtn) deleteBtn.disabled = true;
        openModal('deleteModal');
    }

    function closeDeleteModal() {
        activePdfRow = null;
        // Reset checkbox state on close
        const checkbox = document.getElementById('deleteConfirmCheck');
        const deleteBtn = document.getElementById('deleteConfirmBtn');
        if (checkbox) checkbox.checked = false;
        if (deleteBtn) deleteBtn.disabled = true;
        closeModal('deleteModal');
    }

    function onDeleteCheckChange(checkbox) {
        const deleteBtn = document.getElementById('deleteConfirmBtn');
        if (deleteBtn) deleteBtn.disabled = !checkbox.checked;
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
    async function getRowById(id) {
        try {
            const rows = await window.api.listReimbursementPdfs();
            return rows.find(r => r.id === id) || null;
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
        onDeleteCheckChange
    };
})();

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', pdfLibrary.init);
} else {
    pdfLibrary.init();
}
