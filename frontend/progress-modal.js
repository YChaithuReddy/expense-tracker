// Progress Modal Functions - Global Utility
let progressModal = null;
let progressTimeout = null;

function initProgressModal() {
  progressModal = document.getElementById('global-progress-modal');
  if (!progressModal) {
    console.error('Progress modal not found in DOM');
    return false;
  }
  return true;
}

function showProgress(percent, message = 'Processing...') {
  if (!progressModal && !initProgressModal()) return;

  const modal = progressModal;
  const spinner = modal.querySelector('.progress-spinner');
  const title = modal.querySelector('.progress-title');
  const messageEl = modal.querySelector('.progress-message');
  const progressBar = modal.querySelector('.progress-bar-fill');
  const percentEl = modal.querySelector('.progress-percent');
  const barContainer = modal.querySelector('.progress-bar-container');

  // Show modal
  modal.classList.add('show');

  // Update message
  if (message) {
    const parts = message.split('\n');
    title.textContent = parts[0] || 'Processing...';
    messageEl.textContent = parts[1] || '';
  }

  // Handle progress display
  if (percent === null || percent === undefined) {
    // Indeterminate mode
    spinner.classList.remove('hide');
    barContainer.style.display = 'none';
    percentEl.style.display = 'none';
  } else {
    // Determinate mode
    spinner.classList.add('hide');
    barContainer.style.display = 'block';
    percentEl.style.display = 'block';

    // Ensure percent is within bounds
    percent = Math.max(0, Math.min(100, percent));

    // Update progress bar and text
    progressBar.style.width = percent + '%';
    percentEl.textContent = Math.round(percent) + '%';
  }

  // Clear any existing auto-hide timeout
  if (progressTimeout) {
    clearTimeout(progressTimeout);
    progressTimeout = null;
  }

  // Auto-hide on completion
  if (percent >= 100) {
    progressTimeout = setTimeout(() => {
      hideProgress();
    }, 1500);
  }
}

function hideProgress() {
  if (!progressModal && !initProgressModal()) return;

  progressModal.classList.remove('show');

  // Reset after animation
  setTimeout(() => {
    if (progressModal) {
      const progressBar = progressModal.querySelector('.progress-bar-fill');
      if (progressBar) progressBar.style.width = '0%';
    }
  }, 300);

  // Clear any timeout
  if (progressTimeout) {
    clearTimeout(progressTimeout);
    progressTimeout = null;
  }
}

// Auto-hide after completion
function showProgressWithAutoHide(percent, message, autoHideDelay = 1000) {
  showProgress(percent, message);

  if (percent >= 100) {
    progressTimeout = setTimeout(() => {
      hideProgress();
    }, autoHideDelay);
  }
}

// Example: File Upload with Progress
function uploadFileWithProgress(file) {
  const xhr = new XMLHttpRequest();
  const formData = new FormData();
  formData.append('file', file);

  // Track upload progress
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const percentComplete = Math.round((e.loaded / e.total) * 100);
      showProgress(percentComplete, 'Uploading Bill...\nTransferring data...');
    }
  };

  xhr.onloadstart = () => {
    showProgress(0, 'Uploading Bill...\nInitializing...');
  };

  xhr.onload = () => {
    if (xhr.status === 200) {
      showProgress(100, 'Upload Complete!\nFinalizing...');
      setTimeout(() => hideProgress(), 1500);
    } else {
      hideProgress();
      console.error('Upload failed');
    }
  };

  xhr.onerror = () => {
    hideProgress();
    console.error('Upload error');
  };

  xhr.open('POST', '/api/upload');
  xhr.send(formData);
}

// Example: Fetch with Progress Simulation
async function fetchWithProgress(url, options = {}) {
  showProgress(null, 'Loading...\nFetching data...');

  try {
    const response = await fetch(url, options);

    if (!response.ok) throw new Error('Network response was not ok');

    const contentLength = response.headers.get('content-length');
    if (!contentLength) {
      // No content length, can't show real progress
      const data = await response.json();
      showProgress(100, 'Complete!');
      setTimeout(() => hideProgress(), 500);
      return data;
    }

    // Read response with progress
    const total = parseInt(contentLength, 10);
    let loaded = 0;
    const reader = response.body.getReader();
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      loaded += value.length;

      const percentComplete = Math.round((loaded / total) * 100);
      showProgress(percentComplete, 'Loading...\nReceiving data...');
    }

    // Combine chunks and parse
    const blob = new Blob(chunks);
    const text = await blob.text();
    const data = JSON.parse(text);

    showProgress(100, 'Complete!');
    setTimeout(() => hideProgress(), 500);

    return data;
  } catch (error) {
    hideProgress();
    console.error('Fetch error:', error);
    throw error;
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initProgressModal);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    showProgress,
    hideProgress,
    showProgressWithAutoHide,
    uploadFileWithProgress,
    fetchWithProgress
  };
}