const Razorpay = require('razorpay');
const crypto = require('crypto');

const paymentMode = process.env.PAYMENT_MODE || 'demo';
const keyId = process.env.PAYMENT_KEY_ID || 'demo_key_id';
const keySecret = process.env.PAYMENT_KEY_SECRET || 'demo_key_secret';

const isDemoMode = paymentMode === 'demo' || keyId === 'demo_key_id' || !process.env.PAYMENT_KEY_ID;

let razorpayInstance = null;
if (!isDemoMode) {
  try {
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });
    console.log('[Razorpay] Initialized Razorpay SDK with API keys.');
  } catch (err) {
    console.warn('[Razorpay Warning] Failed to initialize Razorpay SDK:', err.message);
  }
} else {
  console.log('[Payment System] Running in DEMO Payment Mode.');
}

/**
 * Creates a payment order for ₹23.00 (2300 paise)
 */
async function createOrder(amountPaise = 2300, receiptId) {
  if (razorpayInstance && !isDemoMode) {
    const options = {
      amount: amountPaise, // amount in paise
      currency: 'INR',
      receipt: receiptId,
      payment_capture: 1
    };
    return await razorpayInstance.orders.create(options);
  } else {
    // Generate valid Demo payment order
    const demoOrderId = `order_demo_${crypto.randomBytes(10).toString('hex')}`;
    return {
      id: demoOrderId,
      entity: 'order',
      amount: amountPaise,
      amount_paid: 0,
      amount_due: amountPaise,
      currency: 'INR',
      receipt: receiptId,
      status: 'created',
      attempts: 0,
      notes: [],
      created_at: Math.floor(Date.now() / 1000),
      isMock: true,
      isDemo: true,
      key_id: keyId
    };
  }
}

/**
 * Verifies signature of payment payload
 */
function verifySignature(orderId, paymentId, signature) {
  if (!orderId || !paymentId || !signature) return false;

  if (isDemoMode) {
    return (orderId.startsWith('order_demo_') || orderId.startsWith('receipt_')) && signature === 'demo_signature';
  }

  // Strict HMAC-SHA256 signature verification in production mode
  const text = `${orderId}|${paymentId}`;
  const generatedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(text)
    .digest('hex');

  return generatedSignature === signature;
}

/**
 * Verifies Webhook signature
 */
function verifyWebhookSignature(body, signature, webhookSecret) {
  const generatedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(body))
    .digest('hex');
  return generatedSignature === signature;
}

module.exports = {
  keyId,
  keySecret,
  isMockMode: isDemoMode,
  isDemoMode,
  createOrder,
  verifySignature,
  verifyWebhookSignature
};
