/**
 * LSA Membership Multi-Step Registration & Payment Logic
 */

let currentRegistration = null;
let currentOrderData = null;

document.addEventListener('DOMContentLoaded', () => {
  initRegistrationForm();
  initReviewActions();
  initPaymentActions();
  initSameAddressCheckbox();
});

function initSameAddressCheckbox() {
  const sameCheck = document.getElementById('same_address_check');
  const presentInput = document.getElementById('present_address');
  const permanentInput = document.getElementById('permanent_address');

  if (!sameCheck || !presentInput || !permanentInput) return;

  function syncAddress() {
    if (sameCheck.checked) {
      permanentInput.value = presentInput.value;
      permanentInput.readOnly = true;
      permanentInput.style.backgroundColor = 'var(--lsa-light-bg)';
    } else {
      permanentInput.readOnly = false;
      permanentInput.style.backgroundColor = '';
    }
  }

  sameCheck.addEventListener('change', syncAddress);
  presentInput.addEventListener('input', () => {
    if (sameCheck.checked) {
      permanentInput.value = presentInput.value;
    }
  });
}

// Step 1: Submit Form Validation & API Call
function initRegistrationForm() {
  const form = document.getElementById('registration-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const fullName = document.getElementById('full_name').value.trim();
    const gender = document.getElementById('gender').value;
    const island = document.getElementById('island').value;
    const contactNumber = document.getElementById('contact_number').value.trim();
    const email = document.getElementById('email').value.trim();
    const bloodGroup = document.getElementById('blood_group').value;
    const designation = (document.getElementById('designation')?.value || 'Member').trim() || 'Member';
    const presentAddress = (document.getElementById('present_address')?.value || '').trim();
    const permanentAddress = (document.getElementById('permanent_address')?.value || '').trim();

    let hasError = false;

    // Validate Full Name
    if (!fullName || fullName.length < 2) {
      showFieldError('full_name', 'Full name must be at least 2 characters.');
      hasError = true;
    }

    // Validate Gender
    if (!gender) {
      showFieldError('gender', 'Please select gender.');
      hasError = true;
    }

    // Validate Island
    if (!island) {
      showFieldError('island', 'Please select island.');
      hasError = true;
    }

    // Validate Contact Number (10 digits Indian mobile)
    const cleanPhone = contactNumber.replace(/[\s\-\+]/g, '').replace(/^91/, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      showFieldError('contact_number', 'Please enter a valid 10-digit Indian mobile number.');
      hasError = true;
    }

    // Validate Email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFieldError('email', 'Please enter a valid email address.');
      hasError = true;
    }

    // Validate Blood Group
    if (!bloodGroup) {
      showFieldError('blood_group', 'Please select blood group.');
      hasError = true;
    }

    // Validate Addresses
    if (!presentAddress) {
      showFieldError('present_address', 'Please enter present address.');
      hasError = true;
    }
    if (!permanentAddress) {
      showFieldError('permanent_address', 'Please enter permanent address.');
      hasError = true;
    }

    if (hasError) {
      showToast('Please fix the errors before proceeding.', 'error');
      return;
    }

    const submitBtn = document.getElementById('btn-submit-step1');
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Saving Details...';

    try {
      const payload = {
        full_name: fullName,
        gender,
        island,
        contact_number: cleanPhone,
        email,
        blood_group: bloodGroup,
        designation,
        present_address: presentAddress,
        permanent_address: permanentAddress
      };

      const res = await apiFetch('/api/membership/register', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        currentRegistration = res.data;
        populateReviewStep(currentRegistration);
        goToStep(2);
      }
    } catch (err) {
      showToast(err.message || 'Registration failed. Duplicate email or phone.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Continue to Review Step →';
    }
  });
}

function populateReviewStep(data) {
  document.getElementById('rev-name').textContent = data.full_name;
  document.getElementById('rev-gender').textContent = data.gender;
  document.getElementById('rev-island').textContent = data.island;
  document.getElementById('rev-contact').textContent = data.contact_number;
  document.getElementById('rev-email').textContent = data.email;
  document.getElementById('rev-blood').textContent = data.blood_group;
  if (document.getElementById('rev-designation')) {
    document.getElementById('rev-designation').textContent = data.designation || 'Member';
  }
  if (document.getElementById('rev-present-address')) {
    document.getElementById('rev-present-address').textContent = data.present_address || '-';
  }
  if (document.getElementById('rev-permanent-address')) {
    document.getElementById('rev-permanent-address').textContent = data.permanent_address || '-';
  }
}

// Step 2: Review Page Action Listeners
function initReviewActions() {
  const btnEdit = document.getElementById('btn-edit-details');
  const btnProceed = document.getElementById('btn-proceed-payment');

  if (btnEdit) {
    btnEdit.addEventListener('click', () => {
      goToStep(1);
    });
  }

  if (btnProceed) {
    btnProceed.addEventListener('click', () => {
      goToStep(3);
    });
  }
}

// Step 3: Payment Order Creation & Gateway Trigger
function initPaymentActions() {
  const btnPay = document.getElementById('btn-pay-now');
  if (!btnPay) return;

  btnPay.addEventListener('click', async () => {
    if (!currentRegistration || !currentRegistration.memberId) {
      showToast('Session expired. Please restart registration.', 'error');
      goToStep(1);
      return;
    }

    btnPay.disabled = true;
    btnPay.innerHTML = 'Creating Order...';

    try {
      const res = await apiFetch('/api/payment/create-order', {
        method: 'POST',
        body: JSON.stringify({ memberId: currentRegistration.memberId })
      });

      if (res.success) {
        currentOrderData = res.data;
        triggerPaymentGateway(currentOrderData);
      }
    } catch (err) {
      showToast(err.message || 'Failed to initiate payment.', 'error');
    } finally {
      btnPay.disabled = false;
      btnPay.innerHTML = 'Complete Payment (Demo)';
    }
  });

  // Modal Cancel & Success buttons for test sandbox mode
  const modalCancel = document.getElementById('modal-btn-cancel');
  const modalSuccess = document.getElementById('modal-btn-success');
  const modalOverlay = document.getElementById('sandbox-payment-modal');

  if (modalCancel) {
    modalCancel.addEventListener('click', () => {
      modalOverlay.style.display = 'none';
      showToast('Payment cancelled.', 'info');
    });
  }

  if (modalSuccess) {
    modalSuccess.addEventListener('click', async () => {
      modalOverlay.style.display = 'none';
      await processMockPaymentVerification();
    });
  }
}

function copyUpiIdToClipboard() {
  const upiId = document.getElementById('upi-id-display')?.textContent || 'arushkhan2004-1@oksbi';
  navigator.clipboard.writeText(upiId).then(() => {
    showToast('✓ UPI ID copied to clipboard!', 'success');
  }).catch(() => {
    showToast(`UPI ID: ${upiId}`, 'info');
  });
}

function triggerPaymentGateway(orderData) {
  const upiId = orderData.upiId || 'arushkhan2004-1@oksbi';

  // If real Razorpay key is configured and Razorpay SDK loaded
  if (typeof Razorpay !== 'undefined' && orderData.keyId && !orderData.isMock && !orderData.keyId.includes('sample')) {
    const options = {
      key: orderData.keyId,
      amount: orderData.amount, // 300 paise
      currency: orderData.currency,
      name: 'Lakshadweep Students Association',
      description: 'LSA Membership Registration Fee',
      image: 'https://cdn-icons-png.flaticon.com/512/2991/2991106.png',
      order_id: orderData.orderId,
      config: {
        display: {
          blocks: {
            banks: {
              name: 'Pay via UPI',
              instruments: [
                {
                  method: 'upi',
                  vpa: upiId
                }
              ]
            }
          },
          sequence: ['block.banks'],
          preferences: {
            show_default_blocks: false
          }
        }
      },
      handler: async function (response) {
        await verifyBackendPayment({
          memberId: currentRegistration.memberId,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature
        });
      },
      prefill: {
        name: orderData.member.name,
        email: orderData.member.email,
        contact: orderData.member.contact,
        method: 'upi'
      },
      theme: {
        color: '#028090'
      }
    };
    const rzp = new Razorpay(options);
    rzp.open();
  } else {
    // Open UPI Payment Modal
    const modalOverlay = document.getElementById('sandbox-payment-modal');
    document.getElementById('modal-order-id').textContent = orderData.orderId;
    
    const upiDisplayEl = document.getElementById('upi-id-display');
    if (upiDisplayEl) upiDisplayEl.textContent = upiId;

    const qrImgEl = document.getElementById('upi-qr-image');
    if (qrImgEl) {
      const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent('Lakshadweep Students Association')}&am=3.00&cu=INR`;
      qrImgEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUrl)}`;
    }

    const upiLinkEl = document.getElementById('btn-upi-app-link');
    const bhimLinkEl = document.getElementById('btn-bhim-app-link');
    const upiDeepLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent('Lakshadweep Students Association')}&am=3.00&cu=INR`;
    if (upiLinkEl) upiLinkEl.href = upiDeepLink;
    if (bhimLinkEl) bhimLinkEl.href = upiDeepLink;

    modalOverlay.style.display = 'flex';
  }
}

// Generate valid test signature for sandbox mode verification
async function processMockPaymentVerification() {
  if (!currentOrderData || !currentRegistration) return;

  const mockPaymentId = 'pay_' + Math.random().toString(36).substring(2, 15);
  // Compute valid HMAC SHA-256 using standard crypto API
  const text = `${currentOrderData.orderId}|${mockPaymentId}`;
  const secret = 'sample_secret_key_12345';
  
  const mockSignature = await computeHmacSha256(secret, text);

  await verifyBackendPayment({
    memberId: currentRegistration.memberId,
    razorpay_order_id: currentOrderData.orderId,
    razorpay_payment_id: mockPaymentId,
    razorpay_signature: mockSignature
  });
}

// Send signature to Node.js backend for strict verification
async function verifyBackendPayment(verifyPayload) {
  showToast('Verifying payment with LSA server...', 'info');

  try {
    const res = await apiFetch('/api/payment/verify', {
      method: 'POST',
      body: JSON.stringify(verifyPayload)
    });

    if (res.success && res.data) {
      showToast('✓ Payment Verified! Activating Membership...', 'success');
      setTimeout(() => {
        window.location.href = `success?id=${currentRegistration.memberId}`;
      }, 1000);
    }
  } catch (err) {
    showToast(err.message || 'Payment verification failed.', 'error');
  }
}

// Client Helper to compute HMAC SHA256 in browser for sandbox test mode
async function computeHmacSha256(secret, text) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(text);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Step Navigation Helper
function goToStep(stepNumber) {
  const steps = [
    document.getElementById('registration-form'),
    document.getElementById('review-container'),
    document.getElementById('payment-container')
  ];

  steps.forEach((el, idx) => {
    if (el) el.style.display = (idx + 1 === stepNumber) ? 'block' : 'none';
  });

  const progressBar = document.getElementById('step-progress-bar');
  if (progressBar) {
    const percentages = { 1: '33%', 2: '66%', 3: '100%' };
    progressBar.style.width = percentages[stepNumber] || '33%';
  }

  for (let i = 1; i <= 3; i++) {
    const node = document.getElementById(`step-node-${i}`);
    if (node) {
      node.classList.remove('active', 'completed');
      if (i === stepNumber) node.classList.add('active');
      else if (i < stepNumber) node.classList.add('completed');
    }
  }

  window.scrollTo({ top: 120, behavior: 'smooth' });
}

function showFieldError(fieldId, msg) {
  const input = document.getElementById(fieldId);
  const errSpan = document.getElementById(`err-${fieldId}`);
  if (input) input.classList.add('is-invalid');
  if (errSpan) errSpan.textContent = msg;
}

function clearErrors() {
  document.querySelectorAll('.form-control').forEach(el => el.classList.remove('is-invalid'));
  document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
}
