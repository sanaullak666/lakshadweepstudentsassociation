/**
 * LSA Membership Portal - Core Client Utility Script
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  highlightActiveNav();
  initCapsLockInputs();
});

// Auto CAPS LOCK for input fields & textareas (registration forms only)
function initCapsLockInputs() {
  // Do not run caps lock on admin pages or login form
  if (window.location.pathname.includes('/admin') || document.getElementById('admin-login-form') || document.body.classList.contains('login-page-body')) {
    return;
  }

  document.addEventListener('input', (e) => {
    const target = e.target;
    if (!target) return;
    const tag = target.tagName;
    const type = (target.type || '').toLowerCase();
    
    if ((tag === 'INPUT' && type !== 'file' && type !== 'password' && type !== 'hidden' && type !== 'email') || tag === 'TEXTAREA') {
      const start = target.selectionStart;
      const end = target.selectionEnd;
      target.value = target.value.toUpperCase();
      if (start !== null && end !== null) {
        try { target.setSelectionRange(start, end); } catch (err) {}
      }
    }
  });
}

// Mobile Navigation Toggle
function initMobileMenu() {
  const toggleBtn = document.querySelector('.mobile-toggle');
  const navMenu = document.querySelector('.nav-menu');

  if (toggleBtn && navMenu) {
    toggleBtn.addEventListener('click', () => {
      navMenu.classList.toggle('open');
      const isOpen = navMenu.classList.contains('open');
      toggleBtn.setAttribute('aria-expanded', isOpen);
    });
  }
}

// Highlight Current Active Nav Link
function highlightActiveNav() {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.nav-link');

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath || (currentPath === '' && href === 'index.html')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// Toast Notifications Helper
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✓';
  if (type === 'error') icon = '⚠️';

  toast.innerHTML = `
    <span style="font-weight:bold; font-size:1.1rem;">${icon}</span>
    <span style="flex:1;">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Universal API Fetch Wrapper
async function apiFetch(url, options = {}) {
  try {
    const defaultHeaders = {
      'Accept': 'application/json'
    };
    if (!(options.body instanceof FormData)) {
      defaultHeaders['Content-Type'] = 'application/json';
    }

    // Attach admin token if stored in localStorage
    const adminToken = localStorage.getItem('lsa_admin_token');
    if (adminToken) {
      defaultHeaders['Authorization'] = `Bearer ${adminToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      }
    });

    const contentType = response.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 100)}`);
    }

    if (!response.ok) {
      throw new Error(data.message || `Request failed with status ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`[API Error: ${url}]`, error);
    throw error;
  }
}

// Global HTML Escaping Helper
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}
