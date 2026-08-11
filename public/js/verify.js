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
        const verifyUrl = `${window.location.origin}/verify.html?id=${encodeURIComponent(member.membership_id)}`;
        const qrSvg = window.QRCodeGenerator 
          ? window.QRCodeGenerator.renderSVG(verifyUrl, 90)
          : `<img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(verifyUrl)}" style="width:90px; height:90px; display:block;">`;

        resultBox.innerHTML = `
          <!-- DIGITAL MEMBERSHIP CARD FOR PRINT & DOWNLOAD -->
          <div style="background:#ffffff; border-radius:20px; box-shadow:0 10px 30px rgba(0,0,0,0.08); border:1px solid #E2E8F0; overflow:hidden; margin-top:1.5rem; text-align:left;" id="printable-membership-card">
            
            <!-- VERIFIED HEADER BANNER -->
            <div style="background:linear-gradient(135deg, #028090 0%, #002B49 100%); padding:1.75rem 1.5rem; text-align:center; color:#ffffff;">
              <div style="margin-bottom:0.4rem;">
                <span style="background:rgba(5, 150, 105, 0.25); color:#34D399; font-size:0.8rem; font-weight:800; padding:0.3rem 0.9rem; border-radius:50px; border:1px solid rgba(52, 211, 153, 0.4); display:inline-flex; align-items:center; gap:0.35rem;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  OFFICIAL VERIFIED MEMBER
                </span>
              </div>
              <div style="font-size:1.3rem; font-weight:800; letter-spacing:0.5px; color:#ffffff;">Lakshadweep Students Association</div>
              <div style="font-size:0.8rem; opacity:0.85; margin-top:0.15rem; color:#E0F2FE;">Official Digital Membership Pass • Active ${escapeHtml(member.validity_year)}</div>
            </div>

            <!-- CARD BODY -->
            <div style="padding:1.75rem 1.5rem; background:#ffffff;">
              
              <!-- MEMBER HEADER INFO -->
              <div style="display:flex; align-items:center; gap:1.25rem; padding-bottom:1.25rem; border-bottom:1px solid #E2E8F0; flex-wrap:wrap;">
                <div style="width:75px; height:75px; border-radius:50%; background:#E0F2FE; border:3px solid #028090; overflow:hidden; flex-shrink:0; display:flex; align-items:center; justify-content:center;">
                  ${member.photo_url ? `<img src="${member.photo_url}" crossorigin="anonymous" style="width:100%; height:100%; object-fit:cover;">` : `<span style="font-weight:800; font-size:1.6rem; color:#028090;">${escapeHtml(member.full_name.charAt(0))}</span>`}
                </div>

                <div style="flex:1; min-width:180px;">
                  <div style="font-size:0.75rem; color:#64748B; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Member Name</div>
                  <h2 style="color:#028090; font-size:1.45rem; font-weight:800; margin:0 0 0.35rem 0; line-height:1.2;">${escapeHtml(member.full_name)}</h2>
                  <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                    <span style="font-family:monospace; font-weight:800; font-size:0.95rem; background:#F8FAFC; color:#05668D; padding:0.2rem 0.65rem; border-radius:6px; border:1px solid #E2E8F0;">${escapeHtml(member.membership_id)}</span>
                    <span style="background:#E0F2FE; color:#028090; font-weight:700; font-size:0.8rem; padding:0.2rem 0.65rem; border-radius:50px;">${escapeHtml(member.designation || 'Member')}</span>
                  </div>
                </div>
              </div>

              <!-- FIELD METADATA GRID -->
              <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:1rem; padding:1.25rem 0; border-bottom:1px dashed #E2E8F0;">
                
                <div style="background:#F8FAFC; padding:0.75rem 0.9rem; border-radius:10px; border:1px solid #E2E8F0;">
                  <span style="display:block; font-size:0.72rem; color:#64748B; font-weight:700; text-transform:uppercase; margin-bottom:0.2rem;">Native Island</span>
                  <strong style="font-size:1rem; color:#028090; font-weight:700;">${escapeHtml(member.island)}</strong>
                </div>

                <div style="background:#F8FAFC; padding:0.75rem 0.9rem; border-radius:10px; border:1px solid #E2E8F0;">
                  <span style="display:block; font-size:0.72rem; color:#64748B; font-weight:700; text-transform:uppercase; margin-bottom:0.2rem;">Gender</span>
                  <strong style="font-size:1rem; color:#028090; font-weight:700;">${escapeHtml(member.gender || 'Specified')}</strong>
                </div>

                <div style="background:#F8FAFC; padding:0.75rem 0.9rem; border-radius:10px; border:1px solid #E2E8F0;">
                  <span style="display:block; font-size:0.72rem; color:#64748B; font-weight:700; text-transform:uppercase; margin-bottom:0.2rem;">Blood Group</span>
                  <strong style="font-size:1rem; color:#DC2626; font-weight:800;">${escapeHtml(member.blood_group || 'O+')}</strong>
                </div>

                <div style="background:#F8FAFC; padding:0.75rem 0.9rem; border-radius:10px; border:1px solid #E2E8F0;">
                  <span style="display:block; font-size:0.72rem; color:#64748B; font-weight:700; text-transform:uppercase; margin-bottom:0.2rem;">Status</span>
                  <strong style="font-size:0.95rem; color:#059669; font-weight:800; display:inline-flex; align-items:center; gap:0.25rem;">
                    <span style="width:8px; height:8px; background:#059669; border-radius:50%; display:inline-block;"></span>
                    Active Member
                  </strong>
                </div>

              </div>

              <!-- QR CODE & FOOTER -->
              <div style="display:flex; justify-content:space-between; align-items:center; padding-top:1.25rem; flex-wrap:wrap; gap:1rem;">
                <div>
                  <div style="font-size:0.85rem; font-weight:700; color:#028090;">Authorized by LSA Central Executive</div>
                  <div style="font-size:0.75rem; color:#64748B;">Verified online via Official LSA Portal</div>
                </div>

                <div style="text-align:center; background:#ffffff; padding:0.4rem; border-radius:10px; border:1px solid #E2E8F0;">
                  <div style="width:90px; height:90px; display:inline-block;">
                    ${qrSvg}
                  </div>
                  <div style="font-size:0.6rem; color:#64748B; margin-top:0.2rem; font-weight:700;">Scan to Verify</div>
                </div>
              </div>

            </div>

            <!-- ACTION FOOTER -->
            <div class="card-action-footer" style="background:#F8FAFC; padding:1rem 1.5rem; border-top:1px solid #E2E8F0; display:flex; justify-content:flex-end; gap:0.75rem;">
              <button onclick="downloadCardPdf('${escapeHtml(member.membership_id)}')" class="btn btn-primary btn-sm" id="btn-download-pdf" style="font-weight:700; font-size:0.85rem; display:flex; align-items:center; gap:0.4rem;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download Card (PDF)
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

function downloadCardPdf(membershipId) {
  const cardElement = document.getElementById('printable-membership-card');
  if (!cardElement) return;

  const btn = document.getElementById('btn-download-pdf');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = 'Generating PDF...';
  }

  // Clone card element to a isolated container to ensure crisp rendering
  const clone = cardElement.cloneNode(true);
  const actionFooter = clone.querySelector('.card-action-footer');
  if (actionFooter) actionFooter.remove();

  clone.style.width = '600px';
  clone.style.margin = '0 auto';
  clone.style.boxShadow = 'none';

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '640px';
  container.style.background = '#ffffff';
  container.style.padding = '20px';
  container.appendChild(clone);
  document.body.appendChild(container);

  const opt = {
    margin: 0.2,
    filename: `LSA_Membership_${membershipId || 'Card'}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
  };

  function cleanup() {
    if (document.body.contains(container)) document.body.removeChild(container);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download Card (PDF)`;
    }
  }

  if (typeof html2pdf !== 'undefined') {
    html2pdf().set(opt).from(clone).save().then(() => {
      cleanup();
      if (typeof showToast === 'function') {
        showToast('Card PDF downloaded successfully!', 'success');
      }
    }).catch(err => {
      console.error('PDF Generation Error:', err);
      cleanup();
      window.print();
    });
  } else {
    cleanup();
    window.print();
  }
}
