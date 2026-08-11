const db = require('../config/db');
const razorpay = require('../config/razorpay');
const { generateMembershipId } = require('../utils/membershipIdGenerator');

/**
 * Creates a payment order for ₹3.00 (300 paise)
 */
async function createOrder(req, res) {
  try {
    const { memberId } = req.body;

    if (!memberId) {
      return res.status(400).json({
        success: false,
        message: 'Member ID is required.'
      });
    }

    const memberResult = await db.query(
      `SELECT id, full_name, email, contact_number, payment_status, wants_physical_card FROM members WHERE id = ?`,
      [memberId]
    );

    if (!memberResult.rows || memberResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found.'
      });
    }

    const member = memberResult.rows[0];

    if (member.payment_status === 'PAID') {
      return res.status(400).json({
        success: false,
        message: 'This membership registration has already been paid.'
      });
    }

    // Dynamic fee: ₹150.00 for Physical ID Card, ₹3.00 for Digital ID Card
    const wantsPhysical = member.wants_physical_card === 1 || member.wants_physical_card === true || member.wants_physical_card === '1';
    const amountRupees = wantsPhysical ? 150.00 : 3.00;
    const amountPaise = wantsPhysical ? 15000 : 300;
    const receiptId = `receipt_lsa_${memberId}_${Date.now()}`;

    // Create Razorpay Order
    const razorpayOrder = await razorpay.createOrder(amountPaise, receiptId);

    // Save payment record in DB
    await db.query(
      `INSERT INTO payments (member_id, order_id, amount, currency, status, payment_method)
       VALUES (?, ?, ?, 'INR', 'PENDING', 'razorpay')`,
      [memberId, razorpayOrder.id, amountRupees]
    );

    return res.json({
      success: true,
      data: {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount, // in paise
        currency: razorpayOrder.currency,
        keyId: razorpay.keyId,
        isMock: razorpay.isMockMode,
        upiId: process.env.PAYMENT_UPI_ID || 'arushkhan2004-1@oksbi',
        member: {
          id: member.id,
          name: member.full_name,
          email: member.email,
          contact: member.contact_number
        }
      }
    });
  } catch (error) {
    console.error('[Create Order Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create payment order.'
    });
  }
}

/**
 * Verifies Razorpay payment signature & activates membership
 */
async function verifyPayment(req, res) {
  try {
    const { memberId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!memberId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment verification parameters.'
      });
    }

    // 1. Verify HMAC-SHA256 signature
    const isValid = razorpay.verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

    if (!isValid) {
      console.warn(`[Payment Fraud Check] Signature mismatch for order: ${razorpay_order_id}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature. Verification failed.'
      });
    }

    // 2. Fetch member and payment
    const memberResult = await db.query(
      `SELECT id, full_name, email, island, blood_group, payment_status, membership_id FROM members WHERE id = ?`,
      [memberId]
    );

    if (!memberResult.rows || memberResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member record not found.'
      });
    }

    const member = memberResult.rows[0];

    // If already paid, return existing details
    if (member.payment_status === 'PAID' && member.membership_id) {
      return res.json({
        success: true,
        message: 'Payment already verified.',
        data: {
          membershipId: member.membership_id,
          member
        }
      });
    }

    // 3. Generate unique Membership ID
    const newMembershipId = await generateMembershipId();

    // 4. Update payments table
    await db.query(
      `UPDATE payments SET payment_id = ?, status = 'PAID', paid_at = CURRENT_TIMESTAMP WHERE order_id = ? AND member_id = ?`,
      [razorpay_payment_id, razorpay_order_id, memberId]
    );

    // 5. Update members table to PAID and ACTIVE
    await db.query(
      `UPDATE members SET payment_status = 'PAID', registration_status = 'ACTIVE', membership_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newMembershipId, memberId]
    );

    console.log(`[Payment Success] Member #${memberId} activated with Membership ID: ${newMembershipId}`);

    return res.json({
      success: true,
      message: 'Payment successfully verified! Membership activated.',
      data: {
        membershipId: newMembershipId,
        member: {
          id: member.id,
          full_name: member.full_name,
          island: member.island,
          blood_group: member.blood_group,
          membership_id: newMembershipId,
          payment_status: 'PAID',
          registration_status: 'ACTIVE',
          amount: 3.00
        }
      }
    });
  } catch (error) {
    console.error('[Verify Payment Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during payment verification.'
    });
  }
}

/**
 * Webhook handler for async payment confirmations
 */
async function handleWebhook(req, res) {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || 'lsa_webhook_secret_key';

    if (signature && webhookSecret) {
      const isValid = razorpay.verifyWebhookSignature(req.body, signature, webhookSecret);
      if (!isValid) {
        return res.status(400).json({ status: 'invalid signature' });
      }
    }

    const payload = req.body;
    if (payload.event === 'payment.captured' || payload.event === 'order.paid') {
      const entity = payload.payload.payment ? payload.payload.payment.entity : payload.payload.order.entity;
      const orderId = entity.order_id || entity.id;
      const paymentId = entity.id || entity.payment_id;

      // Find pending payment
      const paymentResult = await db.query(`SELECT member_id FROM payments WHERE order_id = ?`, [orderId]);
      if (paymentResult.rows && paymentResult.rows.length > 0) {
        const memberId = paymentResult.rows[0].member_id;
        const newMembershipId = await generateMembershipId();

        await db.query(
          `UPDATE payments SET payment_id = ?, status = 'PAID', paid_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
          [paymentId, orderId]
        );

        await db.query(
          `UPDATE members SET payment_status = 'PAID', registration_status = 'ACTIVE', membership_id = ? WHERE id = ? AND payment_status = 'PENDING'`,
          [newMembershipId, memberId]
        );
      }
    }

    return res.json({ status: 'ok' });
  } catch (error) {
    console.error('[Webhook Error]', error);
    return res.status(500).json({ status: 'error' });
  }
}

/**
 * Public Endpoint: Submit 12-Digit UPI Transaction ID / UTR Number for Admin Verification
 */
async function submitUtrNumber(req, res) {
  try {
    const { memberId, orderId, utrNumber } = req.body;

    if (!memberId || !utrNumber || !utrNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Member ID and 12-Digit UPI Transaction ID (UTR) are required.'
      });
    }

    const cleanUtr = utrNumber.trim().toUpperCase();

    if (cleanUtr.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 12-digit UPI Transaction / UTR ID.'
      });
    }

    // Fetch member
    const memberResult = await db.query(
      `SELECT id, full_name, email, contact_number, payment_status, membership_id FROM members WHERE id = ?`,
      [memberId]
    );

    if (!memberResult.rows || memberResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Member record not found.' });
    }

    const member = memberResult.rows[0];
    if (member.payment_status === 'PAID' && member.membership_id) {
      return res.json({
        success: true,
        message: 'Membership is already paid and activated.',
        data: {
          membershipId: member.membership_id,
          member
        }
      });
    }

    // Insert or update payments record
    const targetOrderId = orderId || `order_upi_${memberId}_${Date.now()}`;

    const existingPayment = await db.query(
      `SELECT id FROM payments WHERE member_id = ? OR order_id = ? LIMIT 1`,
      [memberId, targetOrderId]
    );

    if (existingPayment.rows && existingPayment.rows.length > 0) {
      await db.query(
        `UPDATE payments SET payment_id = ?, status = 'PENDING', payment_method = 'upi_qr' WHERE id = ?`,
        [cleanUtr, existingPayment.rows[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO payments (member_id, order_id, payment_id, amount, currency, status, payment_method)
         VALUES (?, ?, ?, 3.00, 'INR', 'PENDING', 'upi_qr')`,
        [memberId, targetOrderId, cleanUtr]
      );
    }

    // Keep member PENDING until admin approves
    await db.query(
      `UPDATE members SET payment_status = 'PENDING', registration_status = 'PENDING', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [memberId]
    );

    return res.json({
      success: true,
      message: 'UPI Transaction ID submitted successfully! Verification pending by LSA Admin.',
      data: {
        memberId: member.id,
        utrNumber: cleanUtr,
        status: 'PENDING'
      }
    });
  } catch (error) {
    console.error('[Submit UTR Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit UPI Transaction ID.'
    });
  }
}

module.exports = {
  createOrder,
  verifyPayment,
  handleWebhook,
  submitUtrNumber
};
