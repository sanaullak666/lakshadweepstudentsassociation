/**
 * Public Membership Verification & Digital ID Card Generator Script
 */

document.addEventListener('DOMContentLoaded', () => {
  initVerification();
  checkUrlParams();
});

function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const queryId = params.get('id') || params.get('membershipId');
  if (queryId) {
    const input = document.getElementById('verify-membership-id');
    if (input) {
      input.value = queryId;
      document.getElementById('verify-form')?.dispatchEvent(new Event('submit'));
    }
  }
}

function initVerification() {
  const form = document.getElementById('verify-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const input = document.getElementById('verify-membership-id');
    const resultBox = document.getElementById('verify-result');
    const membershipId = input.value.trim().toUpperCase();

    if (!membershipId) {
      showToast('Please enter a valid Membership ID.', 'error');
      return;
    }

    const btn = document.getElementById('btn-verify-submit');
    btn.disabled = true;
    btn.innerHTML = 'Verifying...';
    resultBox.style.display = 'none';

    try {
      const res = await apiFetch(`/api/membership/verify/${encodeURIComponent(membershipId)}`);

      if (res.success && res.data) {
        const member = res.data;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(window.location.origin + '/verify.html?id=' + member.membership_id)}`;

        resultBox.innerHTML = `
          <div style="display:flex; align-items:center; gap:0.5rem; color:var(--lsa-success); font-weight:700; font-size:1.25rem; margin-bottom:1.5rem; justify-content:center;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Verified Authentic LSA Membership
          </div>

          <!-- DIGITAL MEMBERSHIP CARD FOR PRINT & DOWNLOAD -->
          <div class="membership-card" id="printable-membership-card">
            <div class="membership-card-header">
              <div class="logo-box">
                <img src="images/logo.jpg" alt="LSA Logo">
                <div>
                  <div style="font-weight:800; font-size:0.95rem; line-height:1.2;">Lakshadweep Students Association</div>
                  <div style="font-size:0.65rem; opacity:0.85;">Official Digital Membership Card</div>
                </div>
              </div>
              <span class="badge" style="background:rgba(255,255,255,0.25); color:white;">ACTIVE ${member.validity_year}</span>
            </div>

            <div class="membership-card-body" style="position:relative;">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem;">
                <div style="flex:1;">
                  <div class="field">
                    <span class="field-label">Membership ID</span>
                    <span class="field-value" style="font-family:monospace; font-size:1.1rem; color:var(--lsa-secondary);">${escapeHtml(member.membership_id)}</span>
                  </div>
                  <div class="field">
                    <span class="field-label">Full Name</span>
                    <span class="field-value">${escapeHtml(member.full_name)}</span>
                  </div>
                  <div class="field">
                    <span class="field-label">Island / Region</span>
                    <span class="field-value">${escapeHtml(member.island)}</span>
                  </div>
                  <div class="field">
                    <span class="field-label">Designation</span>
                    <span class="field-value">${escapeHtml(member.designation || 'Member')}</span>
                  </div>
                  <div class="field">
                    <span class="field-label">Status</span>
                    <span class="field-value" style="color:var(--lsa-success);">✓ Active Member</span>
                  </div>
                </div>

                <!-- QR CODE -->
                <div style="text-align:center; padding:0.5rem; background:white; border:1px solid #E2E8F0; border-radius:12px; box-shadow:var(--lsa-shadow-sm);">
                  <img src="${qrUrl}" alt="Verification QR Code" style="width:100px; height:100px; display:block;">
                  <div style="font-size:0.6rem; color:var(--lsa-text-light); margin-top:0.2rem;">Scan to Verify</div>
                </div>
              </div>
            </div>

            <div class="membership-card-footer no-print">
              <span style="font-size:0.75rem; color:var(--lsa-text-secondary);">Authorized by LSA Central Executive</span>
              <button onclick="window.print()" class="btn btn-primary btn-sm" style="font-weight:700; display:flex; align-items:center; gap:0.4rem;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download / Print Card (PDF)
              </button>
            </div>
          </div>
        `;
        resultBox.style.display = 'block';
      }
    } catch (err) {
      resultBox.innerHTML = `
        <div style="background:#FEF2F2; border:1px solid #FCA5A5; border-radius:12px; padding:1.5rem; text-align:center;">
          <div style="color:var(--lsa-error); font-weight:700; font-size:1.1rem; margin-bottom:0.5rem; display:flex; align-items:center; justify-content:center; gap:0.4rem;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Invalid or Inactive Membership ID
          </div>
          <p style="color:var(--lsa-text-secondary); font-size:0.9rem;">${escapeHtml(err.message || 'No active LSA membership record found for this ID.')}</p>
        </div>
      `;
      resultBox.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Verify Membership';
    }
  });
}
