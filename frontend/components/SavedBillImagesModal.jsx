import React, { useState } from 'react';
import './SavedBillImagesModal.css';

const SavedBillImagesModal = ({
  isOpen,
  onClose,
  images = [],
  stats = {},
  onDeleteImage,
  onExtendExpiry
}) => {
  const [selectedImage, setSelectedImage] = useState(null);

  if (!isOpen) return null;

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Calculate days until expiry
  const getDaysUntilExpiry = (expiryDate) => {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  // Get expiry badge color
  const getExpiryBadgeClass = (days) => {
    if (days <= 7) return 'badge-danger';
    if (days <= 14) return 'badge-warning';
    return 'badge-success';
  };

  return (
    <>
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={onClose} />

      {/* Modal Panel */}
      <div className="modal-panel">
        {/* Header */}
        <div className="modal-header">
          <div className="header-title">
            <span className="header-icon">🖼️</span>
            <h2>Saved Bill Images</h2>
          </div>
          <button onClick={onClose} className="close-button">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Stats Section */}
        <div className="stats-container">
          <div className="stat-card">
            <div className="stat-label">Total Images</div>
            <div className="stat-value">{stats.totalImages || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Size</div>
            <div className="stat-value">
              {stats.totalSizeMB || '0.00'}
              <span className="stat-unit">MB</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Exported</div>
            <div className="stat-value">{stats.exportedCount || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Expiring Soon</div>
            <div className="stat-value warning">{stats.expiringWithin7Days || 0}</div>
          </div>
        </div>

        {/* Images List */}
        <div className="images-container">
          {images.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <h3>No Saved Images</h3>
              <p>Images will appear here when you use "Clear Data Only" option</p>
            </div>
          ) : (
            <div className="images-grid">
              {images.map((image, index) => {
                const daysLeft = getDaysUntilExpiry(image.expiryDate);
                const badgeClass = getExpiryBadgeClass(daysLeft);

                return (
                  <div key={image._id || index} className="image-card">
                    {/* Image Preview */}
                    <div className="image-preview" onClick={() => setSelectedImage(image)}>
                      <img src={image.url} alt={image.filename} />
                      <div className="image-overlay">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                          <path d="M15 3h6v6m0-6L10 14m-5 2H3v-6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </div>
                    </div>

                    {/* Image Details */}
                    <div className="image-details">
                      <div className="detail-row">
                        <span className="detail-icon">📅</span>
                        <span className="detail-text">{formatDate(image.originalExpenseInfo?.date || image.uploadDate)}</span>
                      </div>

                      <div className="detail-row">
                        <span className="detail-icon">🏪</span>
                        <span className="detail-text">{image.originalExpenseInfo?.vendor || 'Unknown Vendor'}</span>
                      </div>

                      <div className="detail-row">
                        <span className="detail-icon">💰</span>
                        <span className="detail-value">₹{image.originalExpenseInfo?.amount || 0}</span>
                      </div>
                    </div>

                    {/* Expiry Badge */}
                    <div className={`expiry-badge ${badgeClass}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
                        <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      <span>{daysLeft} days left</span>
                    </div>

                    {/* Action Buttons */}
                    <div className="action-buttons">
                      <button
                        onClick={() => onExtendExpiry(image._id)}
                        className="btn-extend"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 4v16m8-8H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        +30 days
                      </button>
                      <button
                        onClick={() => onDeleteImage(image._id)}
                        className="btn-delete"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox for enlarged image */}
      {selectedImage && (
        <div className="lightbox" onClick={() => setSelectedImage(null)}>
          <div className="lightbox-content">
            <img src={selectedImage.url} alt={selectedImage.filename} />
            <button className="lightbox-close" onClick={() => setSelectedImage(null)}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default SavedBillImagesModal;