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
      const err = new Error(data.message || `Request failed with status ${response.status}`);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (error) {
    console.error(`[API Error: ${url}]`, error);
    throw error;
  }
}

// Custom Duplicate Registration Warning Modal
function showDuplicateWarningModal(options = {}) {
  const { membershipId, message } = options;
  const existingModal = document.getElementById('duplicate-warning-modal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'duplicate-warning-modal';
  modal.className = 'modal-backdrop active';
  modal.style.zIndex = '99999';

  const verifyUrl = membershipId ? `/verify.html?query=${encodeURIComponent(membershipId)}` : '/verify.html';

  modal.innerHTML = `
    <div class="modal-card" style="max-width:480px; text-align:center; padding:2rem 1.5rem; border-radius:16px;">
      <div style="width:64px; height:64px; border-radius:50%; background:rgba(234, 179, 8, 0.12); color:#d97706; display:inline-flex; align-items:center; justify-content:center; margin:0 auto 1.25rem; font-size:2rem; border:2px solid rgba(234, 179, 8, 0.3);">
        ⚠️
      </div>
      <h3 style="color:var(--lsa-primary); font-size:1.35rem; margin-bottom:0.5rem; font-weight:800;">Existing Registration Found</h3>
      <p style="color:var(--lsa-text-muted); font-size:0.9rem; line-height:1.5; margin-bottom:1.25rem;">
        ${escapeHtml(message || 'An active LSA membership already exists with this contact number or email address.')}
      </p>
      ${membershipId ? `
        <div style="background:var(--lsa-light-bg); border:1.5px solid var(--lsa-border); padding:0.85rem; border-radius:10px; margin-bottom:1.5rem;">
          <div style="font-size:0.75rem; color:var(--lsa-text-muted); font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">Registered Membership ID</div>
          <div style="font-family:monospace; font-size:1.3rem; font-weight:800; color:var(--lsa-primary); margin-top:0.25rem; letter-spacing:1px;">${escapeHtml(membershipId)}</div>
        </div>
      ` : ''}
      <div style="display:flex; flex-direction:column; gap:0.75rem;">
        <a href="${verifyUrl}" class="btn btn-primary btn-block" style="font-weight:800; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:0.5rem; font-size:0.95rem; padding:0.75rem 1rem;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          Verify & View Registered Profile
        </a>
        <button type="button" class="btn btn-secondary btn-block" onclick="document.getElementById('duplicate-warning-modal').remove()" style="font-weight:700;">Dismiss Warning</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
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
