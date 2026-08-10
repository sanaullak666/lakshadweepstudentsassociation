/**
 * Dynamic Central Committee Loader
 */

document.addEventListener('DOMContentLoaded', () => {
  loadCentralCommittee();
});

async function loadCentralCommittee() {
  const container = document.getElementById('public-committee-grid');
  if (!container) return;

  try {
    const res = await apiFetch('/api/committee');
    
    if (!res.success || !res.data || res.data.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:2rem; background:white; border-radius:12px;">
          <p style="color:var(--text-muted);">No active central committee members listed currently.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = res.data.map(member => {
      const avatarHtml = member.photo_url
        ? `<img src="${escapeHtml(member.photo_url)}" alt="${escapeHtml(member.name)}" class="member-photo">`
        : `<div class="avatar-placeholder">${getInitials(member.name)}</div>`;

      return `
        <div class="committee-card">
          ${avatarHtml}
          <h3 class="member-name">${escapeHtml(member.name)}</h3>
          <p class="member-designation">${escapeHtml(member.designation)}</p>
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error('Error loading committee:', error);
    container.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; color:var(--danger);">
        Failed to load Central Committee data. Please refresh.
      </div>
    `;
  }
}

function getInitials(name) {
  if (!name) return 'LSA';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}
