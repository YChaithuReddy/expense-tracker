import React, { useState, useEffect, useCallback, useRef } from 'react';

// CSS can be imported or use CSS-in-JS
const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(10, 15, 30, 0.9)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    animation: 'fadeIn 0.3s ease',
  },
  card: {
    background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
    borderRadius: '20px',
    padding: '40px',
    minWidth: '320px',
    maxWidth: '90%',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4), 0 0 40px rgba(0, 212, 255, 0.2)',
    textAlign: 'center',
    animation: 'slideUp 0.3s ease',
  },
  spinner: {
    width: '60px',
    height: '60px',
    margin: '0 auto 20px',
    border: '3px solid rgba(255, 255, 255, 0.1)',
    borderTopColor: '#00d4ff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  title: {
    color: '#ffffff',
    fontSize: '24px',
    margin: '0 0 10px',
    fontWeight: 600,
  },
  message: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '16px',
    margin: '0 0 20px',
  },
  progressContainer: {
    height: '8px',
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '15px',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #00d4ff, #00a8cc)',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
    boxShadow: '0 0 10px rgba(0, 212, 255, 0.5)',
  },
  percent: {
    color: '#00d4ff',
    fontSize: '28px',
    fontWeight: 'bold',
    textShadow: '0 0 10px rgba(0, 212, 255, 0.5)',
  },
};

// Progress Modal Component
export function ProgressModal({ isVisible, percent, title, message, onClose }) {
  const [internalPercent, setInternalPercent] = useState(0);

  useEffect(() => {
    if (percent !== null && percent !== undefined) {
      // Animate to new percent
      const timer = setTimeout(() => {
        setInternalPercent(Math.max(0, Math.min(100, percent)));
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [percent]);

  if (!isVisible) return null;

  const isIndeterminate = percent === null || percent === undefined;

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="progress-title">
      <div style={styles.card}>
        {isIndeterminate && <div style={styles.spinner} />}

        <h2 id="progress-title" style={styles.title}>
          {title || 'Processing...'}
        </h2>

        {message && (
          <p style={styles.message}>{message}</p>
        )}

        {!isIndeterminate && (
          <>
            <div style={styles.progressContainer}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${internalPercent}%`,
                }}
              />
            </div>
            <div style={styles.percent}>
              {Math.round(internalPercent)}%
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Hook for Progress Modal
export function useProgressModal() {
  const [modalState, setModalState] = useState({
    isVisible: false,
    percent: null,
    title: '',
    message: '',
  });

  const timeoutRef = useRef(null);

  const showProgress = useCallback((percent, text = 'Processing...') => {
    const lines = text.split('\n');
    setModalState({
      isVisible: true,
      percent,
      title: lines[0] || 'Processing...',
      message: lines[1] || '',
    });

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Auto-hide on completion
    if (percent >= 100) {
      timeoutRef.current = setTimeout(() => {
        hideProgress();
      }, 1500);
    }
  }, []);

  const hideProgress = useCallback(() => {
    setModalState({
      isVisible: false,
      percent: null,
      title: '',
      message: '',
    });

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    modalState,
    showProgress,
    hideProgress,
  };
}

// Example Usage Component
export function FileUploadExample() {
  const { modalState, showProgress, hideProgress } = useProgressModal();
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreview(reader.result);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    // Simulate upload with progress
    showProgress(0, 'Uploading Bill...\nInitializing...');

    // Simulate progress updates
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 200));

      if (i < 30) {
        showProgress(i, 'Uploading Bill...\nConnecting to server...');
      } else if (i < 70) {
        showProgress(i, 'Uploading Bill...\nTransferring data...');
      } else if (i < 90) {
        showProgress(i, 'Uploading Bill...\nFinalizing...');
      } else {
        showProgress(i, 'Upload Complete!\nProcessing...');
      }
    }

    // Auto-hides after 1.5s when reaching 100%
  };

  const handleIndeterminateExample = () => {
    showProgress(null, 'Loading...\nFetching data from server...');

    // Simulate async operation
    setTimeout(() => {
      hideProgress();
    }, 3000);
  };

  return (
    <div style={{ padding: '20px' }}>
      {/* Search Input */}
      <div style={{ position: 'relative', maxWidth: '600px', margin: '0 auto 30px' }}>
        <input
          type="text"
          placeholder="Search by vendor, description, or category..."
          style={{
            width: '100%',
            padding: '14px 20px 14px 50px',
            background: '#2a3447',
            border: '1px solid #3a4457',
            borderRadius: '12px',
            color: '#ffffff',
            fontSize: '16px',
            outline: 'none',
          }}
        />
        <svg
          style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'rgba(255, 255, 255, 0.5)',
          }}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M21 21l-5.2-5.2m0 0A7.5 7.5 0 105.8 15.8l5.2 5.2z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* File Upload with Preview */}
      <div style={{ textAlign: 'center' }}>
        <input
          type="file"
          onChange={handleFileSelect}
          accept="image/*"
          style={{ marginBottom: '20px' }}
        />

        {preview && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              width: '220px',
              height: '180px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid rgba(0, 212, 255, 0.5)',
              borderRadius: '12px',
              background: 'rgba(30, 40, 60, 0.6)',
              padding: '10px',
              margin: '0 auto',
            }}>
              <img
                src={preview}
                alt="Preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
              />
            </div>
            <p style={{ color: '#00d4ff', marginTop: '10px' }}>
              {selectedFile.name}
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            onClick={handleUpload}
            disabled={!selectedFile}
            style={{
              padding: '10px 20px',
              background: selectedFile ? '#00d4ff' : '#666',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: selectedFile ? 'pointer' : 'not-allowed',
            }}
          >
            Upload with Progress
          </button>

          <button
            onClick={handleIndeterminateExample}
            style={{
              padding: '10px 20px',
              background: '#00a8cc',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Show Indeterminate
          </button>
        </div>
      </div>

      {/* Progress Modal */}
      <ProgressModal {...modalState} />
    </div>
  );
}

// Export default for convenience
export default ProgressModal;