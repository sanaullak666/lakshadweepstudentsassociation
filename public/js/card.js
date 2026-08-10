/**
 * Digital Membership Card & Success Page Script
 */

document.addEventListener('DOMContentLoaded', () => {
  loadSuccessDetails();
});

async function loadSuccessDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const memberId = urlParams.get('id');

  if (!memberId) {
    window.location.href = 'index.html';
    return;
  }

  try {
    const res = await apiFetch(`/api/membership/${memberId}`);

    if (!res.success || !res.data) {
      showToast('Registration details not found.', 'error');
      return;
    }

    const member = res.data;

    // Populate Success Summary
    document.getElementById('succ-membership-id').textContent = member.membership_id || 'PENDING';
    document.getElementById('succ-name').textContent = member.full_name;
    document.getElementById('succ-island').textContent = member.island;
    document.getElementById('succ-status').textContent = member.payment_status;

    // Populate Digital Card
    document.getElementById('card-name').textContent = member.full_name;
    document.getElementById('card-membership-id').textContent = member.membership_id || 'LSA-2026-XXXXX';
    document.getElementById('card-island').textContent = member.island;
    document.getElementById('card-blood').textContent = member.blood_group;
    if (document.getElementById('card-designation')) {
      document.getElementById('card-designation').textContent = member.designation || 'Member';
    }

    // Render QR Code containing ONLY the Membership ID
    const qrContainer = document.getElementById('card-qrcode');
    if (qrContainer && window.QRCodeGenerator) {
      qrContainer.innerHTML = window.QRCodeGenerator.renderSVG(member.membership_id || 'LSA-2026-00000', 100);
    }

    // Attach Download & Print Listeners
    initCardActions(member);

  } catch (error) {
    console.error('Error loading success details:', error);
    showToast('Failed to load membership card details.', 'error');
  }
}

function initCardActions(member) {
  const btnPrint = document.getElementById('btn-print-card');
  const btnDownload = document.getElementById('btn-download-card');

  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      window.print();
    });
  }

  if (btnDownload) {
    btnDownload.addEventListener('click', () => {
      downloadCardAsImage(member);
    });
  }
}

function downloadCardAsImage(member) {
  const cardElement = document.getElementById('membership-card-element');
  if (!cardElement) return;

  // Use HTML5 Canvas to render membership card graphic
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');

  // Background Gradient
  const grad = ctx.createLinearGradient(0, 0, 600, 360);
  grad.addColorStop(0, '#05668D');
  grad.addColorStop(0.5, '#028090');
  grad.addColorStop(1, '#00A896');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 600, 360);

  // Border & Header
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 580, 340);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('LAKSHADWEEP STUDENTS ASSOCIATION', 30, 45);

  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#E0F2FE';
  ctx.fillText('OFFICIAL DIGITAL MEMBERSHIP CARD - 2026', 30, 68);

  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.moveTo(30, 85);
  ctx.lineTo(570, 85);
  ctx.stroke();

  // Member Data Fields
  ctx.fillStyle = '#BAE6FD';
  ctx.font = '12px sans-serif';
  ctx.fillText('MEMBER NAME', 30, 120);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(member.full_name.toUpperCase(), 30, 148);

  ctx.fillStyle = '#BAE6FD';
  ctx.font = '12px sans-serif';
  ctx.fillText('MEMBERSHIP ID', 30, 190);

  ctx.fillStyle = '#F4A261';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(member.membership_id || 'LSA-2026-00001', 30, 215);

  ctx.fillStyle = '#BAE6FD';
  ctx.font = '12px sans-serif';
  ctx.fillText('ISLAND', 30, 255);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(member.island, 30, 275);

  ctx.fillStyle = '#BAE6FD';
  ctx.font = '12px sans-serif';
  ctx.fillText('BLOOD GROUP', 220, 255);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(member.blood_group, 220, 275);

  // Status Stamp
  ctx.fillStyle = '#02C39A';
  ctx.fillRect(30, 300, 120, 26);
  ctx.fillStyle = '#05668D';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('STATUS: PAID', 42, 317);

  // Create Download Link
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `LSA_Membership_Card_${member.membership_id || 'Card'}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  showToast('Downloaded membership card PNG!', 'success');
}
