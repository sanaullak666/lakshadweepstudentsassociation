/**
 * Admin Panel Client Utilities & Controller Script
 */

document.addEventListener('DOMContentLoaded', () => {
  initAdminAuthCheck();
});

if (typeof window.escapeHtml !== 'function') {
  window.escapeHtml = function(str) {
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
  };
}

async function checkAdminAuth() {
  const isLoginPage = window.location.pathname.includes('login');
  const adminToken = localStorage.getItem('lsa_admin_token');

  if (isLoginPage) return false;

  if (!adminToken) {
    window.location.href = '/admin/login';
    return false;
  }

  try {
    const res = await fetch('/api/admin/me', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      localStorage.removeItem('lsa_admin_token');
      window.location.href = '/admin/login';
      return false;
    }

    const adminNameEl = document.getElementById('admin-user-name');
    if (adminNameEl) adminNameEl.textContent = data.data.full_name || data.data.email;
    initAdminLogout();
    return true;
  } catch (err) {
    window.location.href = '/admin/login';
    return false;
  }
}

function initAdminAuthCheck() {
  const isLoginPage = window.location.pathname.includes('login');
  if (isLoginPage) {
    initAdminLoginForm();
  } else {
    checkAdminAuth();
  }
}

function initAdminLoginForm() {
  const form = document.getElementById('admin-login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const btn = document.getElementById('btn-login-submit');
    btn.disabled = true;
    btn.innerHTML = 'Authenticating...';

    try {
      const res = await apiFetch('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (res.success && res.data.token) {
        localStorage.setItem('lsa_admin_token', res.data.token);
        showToast('Login successful! Redirecting...', 'success');
        setTimeout(() => {
          window.location.href = '/admin/dashboard';
        }, 600);
      }
    } catch (err) {
      showToast(err.message || 'Invalid email or password.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Login to Dashboard';
    }
  });
}

function initAdminLogout() {
  const logoutBtn = document.getElementById('btn-admin-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await apiFetch('/api/admin/logout', { method: 'POST' });
      } catch (e) {}
      localStorage.removeItem('lsa_admin_token');
      window.location.href = '/admin/login';
    });
  }
}

// Dashboard Page Stats Loader
async function loadDashboardStats() {
  const isAuth = await checkAdminAuth();
  if (!isAuth) return;

  try {
    const res = await apiFetch('/api/admin/stats');
    if (res.success && res.data) {
      const d = res.data;
      if (document.getElementById('stat-total')) document.getElementById('stat-total').textContent = d.totalMembers;
      if (document.getElementById('stat-paid')) document.getElementById('stat-paid').textContent = d.paidMembers;
      if (document.getElementById('stat-pending')) document.getElementById('stat-pending').textContent = d.pendingPayments;
      if (document.getElementById('stat-committee')) document.getElementById('stat-committee').textContent = d.activeCommittee;

      // Render Island Stats
      const islandGrid = document.getElementById('island-stats-grid');
      if (islandGrid && d.islandStats) {
        islandGrid.innerHTML = d.islandStats.map(i => `
          <div style="background:white; padding:1rem; border-radius:8px; border:1px solid #E2E8F0; text-align:center;">
            <div style="font-size:1.25rem; font-weight:700; color:var(--primary-deep);">${i.count}</div>
            <div style="font-size:0.85rem; color:var(--text-muted);">${escapeHtml(i.island)}</div>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// Members Management Page Loader
async function loadAdminMembers() {
  const isAuth = await checkAdminAuth();
  if (!isAuth) return;

  const tableBody = document.getElementById('admin-members-tbody');
  if (!tableBody) return;

  const search = (document.getElementById('filter-search')?.value || '').trim();
  const island = document.getElementById('filter-island')?.value || '';
  const blood = document.getElementById('filter-blood')?.value || '';
  const gender = document.getElementById('filter-gender')?.value || '';
  const status = document.getElementById('filter-status')?.value || '';

  tableBody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:2rem;">Loading members...</td></tr>`;

  try {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (island) params.append('island', island);
    if (blood) params.append('blood_group', blood);
    if (gender) params.append('gender', gender);
    if (status) params.append('payment_status', status);

    const res = await apiFetch(`/api/admin/members?${params.toString()}`);
    
    if (!res.success || res.data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:2rem; color:var(--text-muted);">No members match the query filters.</td></tr>`;
      return;
    }

    window.adminMemberList = res.data;

    tableBody.innerHTML = res.data.map(m => `
      <tr>
        <td><strong style="font-family:monospace; color:var(--primary-deep);">${escapeHtml(m.membership_id || 'PENDING')}</strong></td>
        <td><strong>${escapeHtml(m.full_name)}</strong></td>
        <td>${escapeHtml(m.gender)}</td>
        <td>${escapeHtml(m.island)}</td>
        <td>${escapeHtml(m.contact_number)}</td>
        <td>${escapeHtml(m.email)}</td>
        <td><span class="badge" style="background:#F1F5F9; color:var(--dark-navy);">${escapeHtml(m.blood_group)}</span></td>
        <td><span style="font-weight:600; color:var(--lsa-primary);">${escapeHtml(m.designation || 'Member')}</span></td>
        <td>
          <span class="badge ${m.payment_status === 'PAID' ? 'badge-paid' : 'badge-pending'}">
            ${m.payment_status}
          </span>
        </td>
        <td>${new Date(m.created_at).toLocaleDateString()}</td>
        <td>
          <div style="display:flex; gap:0.4rem;">
            <button class="btn btn-sm btn-secondary" onclick="openEditMemberModalById(${m.id})" style="font-weight:600; padding:0.25rem 0.6rem; font-size:0.75rem;">Edit</button>
            <button class="btn btn-sm btn-secondary" style="color:var(--danger); font-weight:600; padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="deleteGeneralMember(${m.id})">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="11" style="text-align:center; color:var(--text-muted); padding:2rem;">No members recorded yet.</td></tr>`;
  }
}

function openEditMemberModalById(memberId) {
  if (!window.adminMemberList) return;
  const member = window.adminMemberList.find(m => m.id === memberId);
  if (!member) return;

  document.getElementById('edit-member-id').value = member.id;
  document.getElementById('edit-member-name').value = member.full_name || '';
  document.getElementById('edit-member-gender').value = member.gender || 'Male';
  document.getElementById('edit-member-island').value = member.island || 'Agatti';
  document.getElementById('edit-member-contact').value = member.contact_number || '';
  document.getElementById('edit-member-blood').value = member.blood_group || 'A+';
  document.getElementById('edit-member-email').value = member.email || '';
  document.getElementById('edit-member-designation').value = member.designation || 'Member';
  document.getElementById('edit-member-payment-status').value = member.payment_status || 'PENDING';
  document.getElementById('edit-member-membership-id').value = member.membership_id || '';

  document.getElementById('edit-member-modal').style.display = 'flex';
}

function closeEditMemberModal() {
  document.getElementById('edit-member-modal').style.display = 'none';
}

async function saveMemberDetails(e) {
  e.preventDefault();
  const id = document.getElementById('edit-member-id').value;
  const btn = document.getElementById('btn-save-member-edit');

  const payload = {
    full_name: document.getElementById('edit-member-name').value.trim(),
    gender: document.getElementById('edit-member-gender').value,
    island: document.getElementById('edit-member-island').value,
    contact_number: document.getElementById('edit-member-contact').value.trim(),
    email: document.getElementById('edit-member-email').value.trim(),
    blood_group: document.getElementById('edit-member-blood').value,
    designation: document.getElementById('edit-member-designation').value.trim(),
    payment_status: document.getElementById('edit-member-payment-status').value,
    membership_id: document.getElementById('edit-member-membership-id').value.trim()
  };

  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const res = await apiFetch(`/api/admin/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    if (res.success) {
      showToast(res.message || 'Member profile updated successfully!', 'success');
      closeEditMemberModal();
      loadAdminMembers();
    }
  } catch (err) {
    showToast(err.message || 'Failed to update member.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Changes';
  }
}

async function deleteGeneralMember(id) {
  if (!confirm('Are you sure you want to delete this member profile from the database?')) return;

  try {
    const res = await apiFetch(`/api/admin/members/${id}`, { method: 'DELETE' });
    if (res.success) {
      showToast(res.message || 'Member deleted from database.', 'success');
      loadAdminMembers();
    }
  } catch (err) {
    showToast(err.message || 'Failed to delete member.', 'error');
  }
}

// Committee Management Page Loader
async function loadAdminCommittee() {
  const isAuth = await checkAdminAuth();
  if (!isAuth) return;

  loadAdminCommitteeLinks();

  const tbody = document.getElementById('admin-committee-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem;">Loading committee...</td></tr>`;

  try {
    const res = await apiFetch('/api/committee/all');
    if (!res.success || !res.data || res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">No committee members added yet. Click "+ Add Committee Member" above to add one.</td></tr>`;
      return;
    }

    window.adminCommitteeList = res.data;

    tbody.innerHTML = res.data.map(c => {
      const photoCell = c.photo_url 
        ? `<img src="${escapeHtml(c.photo_url)}" alt="${escapeHtml(c.name)}" style="width:42px; height:42px; border-radius:50%; object-fit:cover; border:2px solid var(--lsa-border-light);">` 
        : `<div style="width:42px; height:42px; border-radius:50%; background:var(--lsa-light-blue); color:var(--lsa-primary); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.85rem;">${getInitials(c.name)}</div>`;

      return `
      <tr>
        <td><strong>${c.display_order}</strong></td>
        <td>${photoCell}</td>
        <td><strong>${escapeHtml(c.name)}</strong></td>
        <td><span style="color:var(--primary-teal); font-weight:600;">${escapeHtml(c.designation)}</span></td>
        <td>
          <button class="btn btn-sm ${c.is_active ? 'btn-primary' : 'btn-secondary'}" onclick="toggleCommitteeActive(${c.id})">
            ${c.is_active ? '✓ Active' : 'Inactive'}
          </button>
        </td>
        <td>${c.created_at ? new Date(c.created_at).toLocaleDateString() : '-'}</td>
        <td>
          <div style="display:flex; gap:0.5rem;">
            <button class="btn btn-sm btn-secondary" onclick="openEditCommitteeModalById(${c.id})">Edit</button>
            <button class="btn btn-sm btn-secondary" style="color:var(--danger);" onclick="deleteCommitteeMember(${c.id})">Delete</button>
          </div>
        </td>
      </tr>
    `}).join('');
  } catch (err) {
    console.error('Error loading admin committee:', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--danger); padding:2rem;">Failed to load committee: ${escapeHtml(err.message || 'Error')}</td></tr>`;
  }
}

async function loadAdminCommitteeLinks() {
  const grid = document.getElementById('committee-links-grid');
  if (!grid) return;

  try {
    const res = await apiFetch('/api/committee/links');
    if (res.success && res.data) {
      const baseUrl = window.location.origin;
      grid.innerHTML = res.data.map(item => {
        const fullLink = `${baseUrl}${item.link}`;
        const shareText = `Central Committee Access Portal (${item.title})\nLink: ${fullLink}\nAccess Password: ${item.access_password}`;

        const statusBadge = item.is_registered
          ? `<span style="background:var(--lsa-success-bg); color:var(--lsa-success); font-size:0.75rem; padding:0.2rem 0.6rem; border-radius:50px; font-weight:700;">✓ ${escapeHtml(item.member.name)}</span>`
          : `<span style="background:#FFF3CD; color:#856404; font-size:0.75rem; padding:0.2rem 0.6rem; border-radius:50px; font-weight:700;">⏳ Pending Registration</span>`;

        return `
          <div style="background:white; border-radius:12px; padding:1.1rem; border:1px solid var(--lsa-border-light); display:flex; flex-direction:column; justify-content:space-between; box-shadow:var(--lsa-shadow-sm);">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
                <strong style="color:var(--lsa-primary); font-size:1.05rem;">${escapeHtml(item.title)}</strong>
                <span style="font-family:var(--lsa-font-mono); font-size:0.8rem; font-weight:700; background:var(--lsa-light-blue); color:var(--lsa-primary); padding:0.15rem 0.5rem; border-radius:4px;">${item.reserved_id}</span>
              </div>
              <div style="margin-bottom:0.6rem;">
                ${statusBadge}
              </div>
              <div style="font-size:0.85rem; color:var(--lsa-primary); background:var(--lsa-light-bg); padding:0.4rem 0.65rem; border-radius:6px; font-weight:700; font-family:var(--lsa-font-mono); margin-bottom:0.8rem; display:flex; justify-content:space-between; align-items:center; border:1px solid var(--lsa-border-light);">
                <span>🔑 Pass: <code>${escapeHtml(item.access_password)}</code></span>
                <button class="btn btn-sm btn-secondary" onclick="openRolePassModal('${item.key}', '${escapeHtml(item.title)}', '${escapeHtml(item.access_password)}')" style="padding:0.15rem 0.5rem; font-size:0.75rem; font-weight:700;">Edit</button>
              </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr; gap:0.4rem; margin-top:0.2rem;">
              <button class="btn btn-sm btn-primary btn-block" onclick="copyCommitteeLink(\`${escapeHtml(shareText)}\`, 'Link & Password copied!')" style="font-weight:700;">
                📋 Copy Link & Password
              </button>
              <button class="btn btn-sm btn-secondary btn-block" onclick="copyCommitteeLink('${fullLink}', 'Link copied!')" style="font-weight:600;">
                🔗 Copy Link Only
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Failed to load committee links:', err);
  }
}

function openRolePassModal(key, title, currentPassword) {
  document.getElementById('role-pass-key').value = key;
  document.getElementById('role-pass-title-display').value = title;
  document.getElementById('role-new-password').value = currentPassword || '';
  document.getElementById('role-pass-modal').style.display = 'flex';
}

function closeRolePassModal() {
  document.getElementById('role-pass-modal').style.display = 'none';
}

async function saveRolePassword(e) {
  e.preventDefault();
  const key = document.getElementById('role-pass-key').value;
  const newPassword = document.getElementById('role-new-password').value.trim();
  const btn = document.getElementById('btn-save-role-pass');

  if (!key || !newPassword) {
    showToast('Please enter a valid password.', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const res = await apiFetch('/api/committee/update-role-password', {
      method: 'POST',
      body: JSON.stringify({ positionKey: key, newPassword })
    });

    if (res.success) {
      showToast(res.message || 'Access password updated successfully!', 'success');
      closeRolePassModal();
      loadAdminCommitteeLinks();
    }
  } catch (err) {
    showToast(err.message || 'Failed to update access password.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Password';
  }
}

function copyCommitteeLink(textToCopy, successMsg = 'Copied to clipboard!') {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textToCopy).then(() => {
      showToast(successMsg, 'success');
    }).catch(() => {
      fallbackCopyText(textToCopy, successMsg);
    });
  } else {
    fallbackCopyText(textToCopy, successMsg);
  }
}

function fallbackCopyText(text, successMsg = 'Copied!') {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand('copy');
    showToast(successMsg, 'success');
  } catch (err) {
    showToast('Failed to copy text.', 'error');
  }
  document.body.removeChild(textArea);
}


// Payments Management Page Loader
async function loadAdminPayments() {
  const isAuth = await checkAdminAuth();
  if (!isAuth) return;

  const tbody = document.getElementById('admin-payments-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem;">Loading payments...</td></tr>`;

  try {
    const res = await apiFetch('/api/admin/payments');
    if (!res.success || !res.data || res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">No payment transactions recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data.map(p => `
      <tr>
        <td><strong>${escapeHtml(p.full_name || 'Member #' + p.member_id)}</strong></td>
        <td><span style="font-family:monospace;">${escapeHtml(p.membership_id || 'PENDING')}</span></td>
        <td><strong>₹${parseFloat(p.amount).toFixed(2)}</strong></td>
        <td><small style="font-family:monospace;">${escapeHtml(p.order_id)}</small></td>
        <td><small style="font-family:monospace;">${escapeHtml(p.payment_id || '-')}</small></td>
        <td>
          <span class="badge ${p.status === 'PAID' ? 'badge-paid' : 'badge-pending'}">${p.status}</span>
        </td>
        <td>${p.paid_at ? new Date(p.paid_at).toLocaleString() : '-'}</td>
        <td>${new Date(p.created_at).toLocaleString()}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:2rem;">No payment transactions recorded yet.</td></tr>`;
  }
}

// Export CSV Action
function exportMembersCSV() {
  const adminToken = localStorage.getItem('lsa_admin_token');
  if (!adminToken) {
    window.location.href = 'login.html';
    return;
  }
  window.open(`/api/admin/export/csv?token=${adminToken}`, '_blank');
}

// Committee CRUD actions & Photo Helpers
let removePhotoFlag = false;

function getInitials(name) {
  if (!name) return 'LSA';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function previewCommitteePhoto(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast('Image size cannot exceed 5MB.', 'error');
    e.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(evt) {
    const imgEl = document.getElementById('committee-photo-img');
    const placeholder = document.getElementById('committee-photo-placeholder');
    const removeBtn = document.getElementById('btn-remove-photo');

    if (imgEl) {
      imgEl.src = evt.target.result;
      imgEl.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';
    if (removeBtn) removeBtn.style.display = 'inline-block';
    removePhotoFlag = false;
  };
  reader.readAsDataURL(file);
}

function removeCommitteePhoto() {
  const photoInput = document.getElementById('committee-photo');
  const photoUrlInput = document.getElementById('committee-photo-url');
  const imgEl = document.getElementById('committee-photo-img');
  const placeholder = document.getElementById('committee-photo-placeholder');
  const removeBtn = document.getElementById('btn-remove-photo');

  if (photoInput) photoInput.value = '';
  if (photoUrlInput) photoUrlInput.value = '';
  if (imgEl) {
    imgEl.src = '';
    imgEl.style.display = 'none';
  }
  if (placeholder) placeholder.style.display = 'block';
  if (removeBtn) removeBtn.style.display = 'none';
  removePhotoFlag = true;
}

async function toggleCommitteeActive(id) {
  try {
    const res = await apiFetch(`/api/committee/${id}/toggle`, { method: 'PATCH' });
    if (res.success) {
      showToast(res.message, 'success');
      loadAdminCommittee();
    }
  } catch (e) {
    showToast('Failed to update active status.', 'error');
  }
}

async function deleteCommitteeMember(id) {
  if (!confirm('Are you sure you want to delete this committee member from the database?')) return;
  try {
    const res = await apiFetch(`/api/committee/${id}`, { method: 'DELETE' });
    if (res.success) {
      showToast(res.message || 'Committee member deleted from database.', 'success');
      loadAdminCommittee();
      loadAdminCommitteeLinks();
    }
  } catch (e) {
    showToast(e.message || 'Failed to delete member.', 'error');
  }
}

function openAddCommitteeModal() {
  removePhotoFlag = false;
  document.getElementById('committee-id').value = '';
  document.getElementById('committee-name').value = '';
  document.getElementById('committee-designation').value = '';
  document.getElementById('committee-order').value = '1';
  document.getElementById('committee-active').checked = true;
  document.getElementById('committee-photo-url').value = '';

  const photoInput = document.getElementById('committee-photo');
  if (photoInput) photoInput.value = '';

  const imgEl = document.getElementById('committee-photo-img');
  const placeholder = document.getElementById('committee-photo-placeholder');
  const removeBtn = document.getElementById('btn-remove-photo');

  if (imgEl) { imgEl.src = ''; imgEl.style.display = 'none'; }
  if (placeholder) placeholder.style.display = 'block';
  if (removeBtn) removeBtn.style.display = 'none';

  document.getElementById('committee-modal-title').textContent = 'Add Committee Member';
  document.getElementById('committee-modal').style.display = 'flex';
}

function openEditCommitteeModalById(id) {
  const member = (window.adminCommitteeList || []).find(m => m.id == id);
  if (!member) return;
  openEditCommitteeModal(member.id, member.name, member.designation, member.display_order, member.is_active, member.photo_url || '');
}

function openEditCommitteeModal(id, name, designation, order, active, photo_url = '') {
  removePhotoFlag = false;
  document.getElementById('committee-id').value = id;
  document.getElementById('committee-name').value = name;
  document.getElementById('committee-designation').value = designation;
  document.getElementById('committee-order').value = order;
  document.getElementById('committee-active').checked = !!active;
  document.getElementById('committee-photo-url').value = photo_url || '';

  const photoInput = document.getElementById('committee-photo');
  if (photoInput) photoInput.value = '';

  const imgEl = document.getElementById('committee-photo-img');
  const placeholder = document.getElementById('committee-photo-placeholder');
  const removeBtn = document.getElementById('btn-remove-photo');

  if (photo_url) {
    if (imgEl) { imgEl.src = photo_url; imgEl.style.display = 'block'; }
    if (placeholder) placeholder.style.display = 'none';
    if (removeBtn) removeBtn.style.display = 'inline-block';
  } else {
    if (imgEl) { imgEl.src = ''; imgEl.style.display = 'none'; }
    if (placeholder) placeholder.style.display = 'block';
    if (removeBtn) removeBtn.style.display = 'none';
  }

  document.getElementById('committee-modal-title').textContent = 'Edit Committee Member';
  document.getElementById('committee-modal').style.display = 'flex';
}

function closeCommitteeModal() {
  document.getElementById('committee-modal').style.display = 'none';
}

async function saveCommitteeMember(e) {
  e.preventDefault();
  const id = document.getElementById('committee-id').value;
  const name = document.getElementById('committee-name').value.trim();
  const designation = document.getElementById('committee-designation').value.trim();
  const display_order = document.getElementById('committee-order').value;
  const is_active = document.getElementById('committee-active').checked ? 1 : 0;
  const fileInput = document.getElementById('committee-photo');
  const saveBtn = document.getElementById('btn-save-committee');

  const formData = new FormData();
  formData.append('name', name);
  formData.append('designation', designation);
  formData.append('display_order', display_order);
  formData.append('is_active', is_active);

  if (fileInput && fileInput.files && fileInput.files[0]) {
    formData.append('photo', fileInput.files[0]);
  }
  if (removePhotoFlag) {
    formData.append('remove_photo', 'true');
  }

  const method = id ? 'PUT' : 'POST';
  const endpoint = id ? `/api/committee/${id}` : '/api/committee';

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = 'Saving...';
  }

  try {
    const res = await apiFetch(endpoint, {
      method,
      body: formData
    });

    if (res.success) {
      showToast(res.message, 'success');
      closeCommitteeModal();
      loadAdminCommittee();
    }
  } catch (err) {
    showToast(err.message || 'Failed to save committee member.', 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = 'Save Committee Member';
    }
  }
}

