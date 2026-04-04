// frontend/js/navigation.js
// Shared navigation, header, and routing logic for all pages

(function() {
  'use strict';

  // ==========================================================================
  // ROUTING
  // ==========================================================================

  /**
   * Extract the current page name from the URL path.
   * Handles both /dashboard.html (root level) and /pages/expenses.html patterns.
   */
  function getCurrentPage() {
    var path = window.location.pathname;
    // Get the filename without extension
    var match = path.match(/\/([^\/]+?)(?:\.html)?$/);
    if (match) {
      return match[1].toLowerCase();
    }
    return 'dashboard';
  }

  /**
   * Navigate to a page by name.
   * Determines the correct relative path based on current location.
   */
  function navigateTo(page) {
    var currentPath = window.location.pathname;
    var isInPagesDir = currentPath.indexOf('/pages/') !== -1;

    if (page === 'dashboard') {
      window.location.href = isInPagesDir ? '../dashboard.html' : 'dashboard.html';
    } else {
      window.location.href = isInPagesDir ? './' + page + '.html' : 'pages/' + page + '.html';
    }
  }

  /**
   * Set the active state on the correct sidebar nav item based on current page.
   */
  function initRouter() {
    var currentPage = getCurrentPage();

    // Remove all existing active classes
    var allNavItems = document.querySelectorAll('.sidebar-nav-item, .sidebar-footer-item');
    allNavItems.forEach(function(item) {
      item.classList.remove('active');
    });

    // Find the matching nav item by href
    allNavItems.forEach(function(item) {
      var href = item.getAttribute('href');
      if (!href || href === '#') return;

      // Extract page name from href
      var hrefMatch = href.match(/\/([^\/]+?)(?:\.html)?$/);
      if (!hrefMatch) {
        // Handle bare filename like "dashboard.html"
        hrefMatch = href.match(/^\.?\/?([\w-]+)(?:\.html)?$/);
      }
      if (hrefMatch && hrefMatch[1].toLowerCase() === currentPage) {
        item.classList.add('active');
      }
    });
  }

  // ==========================================================================
  // SIDEBAR
  // ==========================================================================

  var sidebarOpen = false;

  function initSidebar() {
    var hamburgerBtn = document.getElementById('hamburger-btn');
    var sidebar = document.querySelector('.sidebar');
    var overlay = document.getElementById('sidebar-overlay');

    if (!sidebar) return;

    // Create overlay if it doesn't exist
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      overlay.id = 'sidebar-overlay';
      document.body.appendChild(overlay);
    }

    // Hamburger toggle
    if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleSidebar();
      });
    }

    // Overlay click to close
    overlay.addEventListener('click', function() {
      closeSidebar();
    });

    // Close sidebar when clicking outside
    document.addEventListener('click', function(e) {
      if (sidebarOpen && sidebar && !sidebar.contains(e.target) &&
          (!hamburgerBtn || !hamburgerBtn.contains(e.target))) {
        closeSidebar();
      }
    });

    // ESC key to close sidebar
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && sidebarOpen) {
        closeSidebar();
      }
    });

    // Logout handler on sidebar footer
    var footerItems = document.querySelectorAll('.sidebar-footer-item');
    footerItems.forEach(function(item) {
      var label = item.querySelector('.sidebar-nav-label');
      if (label && label.textContent.trim().toLowerCase() === 'logout') {
        item.addEventListener('click', function(e) {
          e.preventDefault();
          handleLogout();
        });
      }
    });
  }

  function toggleSidebar() {
    if (sidebarOpen) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  function openSidebar() {
    var sidebar = document.querySelector('.sidebar');
    var overlay = document.getElementById('sidebar-overlay');
    if (sidebar) {
      sidebar.classList.add('open');
      sidebarOpen = true;
    }
    if (overlay) {
      overlay.classList.add('active');
    }
  }

  function closeSidebar() {
    var sidebar = document.querySelector('.sidebar');
    var overlay = document.getElementById('sidebar-overlay');
    if (sidebar) {
      sidebar.classList.remove('open');
      sidebarOpen = false;
    }
    if (overlay) {
      overlay.classList.remove('active');
    }
  }

  // ==========================================================================
  // HEADER
  // ==========================================================================

  function initHeader() {
    initSearch();
    initUserProfile();
  }

  function initSearch() {
    var searchInput = document.querySelector('.header-search-input');
    if (!searchInput) return;

    // Pre-fill search from URL query param if on expenses page
    var currentPage = getCurrentPage();
    if (currentPage === 'expenses') {
      var params = new URLSearchParams(window.location.search);
      var searchQuery = params.get('search');
      if (searchQuery) {
        searchInput.value = searchQuery;
        // Trigger filter if the page has a filter-search input
        var filterSearch = document.getElementById('filter-search');
        if (filterSearch) {
          filterSearch.value = searchQuery;
          filterSearch.dispatchEvent(new Event('input'));
        }
      }
    }

    // Handle Enter key on search
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearch(this.value.trim());
      }
    });
  }

  function handleSearch(query) {
    if (!query) return;

    var currentPage = getCurrentPage();
    if (currentPage === 'expenses') {
      // Already on expenses page — just update the filter
      var filterSearch = document.getElementById('filter-search');
      if (filterSearch) {
        filterSearch.value = query;
        filterSearch.dispatchEvent(new Event('input'));
      }
    } else {
      // Navigate to expenses page with search param
      var currentPath = window.location.pathname;
      var isInPagesDir = currentPath.indexOf('/pages/') !== -1;
      var expensesUrl = isInPagesDir
        ? './expenses.html?search=' + encodeURIComponent(query)
        : 'pages/expenses.html?search=' + encodeURIComponent(query);
      window.location.href = expensesUrl;
    }
  }

  function initUserProfile() {
    // Only update if getCurrentUser is available (supabase-auth.js loaded)
    if (typeof getCurrentUser !== 'function') return;

    var user = getCurrentUser();
    if (!user) return;

    var nameEl = document.querySelector('.header-user-name');
    var emailEl = document.querySelector('.header-user-email');
    var avatarEl = document.querySelector('.header-user-avatar');

    if (nameEl) nameEl.textContent = user.name || 'User';
    if (emailEl) emailEl.textContent = user.email || '';
    if (avatarEl) {
      var initials = (user.name || 'U')
        .split(' ')
        .map(function(n) { return n[0]; })
        .join('')
        .toUpperCase()
        .slice(0, 2);
      avatarEl.textContent = initials;
    }
  }

  function handleLogout() {
    if (typeof logout === 'function') {
      logout();
    } else {
      // Fallback: redirect to login
      window.location.href = '/login.html';
    }
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  document.addEventListener('DOMContentLoaded', function() {
    initRouter();
    initSidebar();
    initHeader();
  });

  // Expose utilities globally for page-specific scripts
  window.navigation = {
    getCurrentPage: getCurrentPage,
    navigateTo: navigateTo,
    toggleSidebar: toggleSidebar,
    closeSidebar: closeSidebar,
    handleSearch: handleSearch,
    handleLogout: handleLogout
  };

})();
