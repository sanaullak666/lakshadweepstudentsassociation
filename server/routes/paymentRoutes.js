const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// POST /api/payment/create-order - Create Razorpay payment order for ₹3.00
router.post('/create-order', paymentController.createOrder);

// POST /api/payment/verify - Verify Razorpay signature and activate membership
router.post('/verify', paymentController.verifyPayment);

// POST /api/payment/submit-utr - Submit 12-digit UTR ID for Admin verification
router.post('/submit-utr', paymentController.submitUtrNumber);

// POST /api/payment/webhook - Handle Razorpay webhook notifications
router.post('/webhook', express.json({ type: 'application/json' }), paymentController.handleWebhook);

module.exports = router;
