const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAdmin } = require('../middleware/auth');

// Auth routes
router.post('/login', adminController.login);
router.post('/logout', adminController.logout);
router.get('/me', requireAdmin, adminController.getMe);

// Dashboard & Management routes
router.get('/stats', requireAdmin, adminController.getStats);
router.get('/members', requireAdmin, adminController.getMembers);
router.put('/members/:id', requireAdmin, adminController.updateMember);
router.delete('/members/:id', requireAdmin, adminController.deleteMember);
router.get('/payments', requireAdmin, adminController.getPayments);
router.post('/payments/approve', requireAdmin, adminController.approvePayment);
router.post('/payments/reject', requireAdmin, adminController.rejectPayment);
router.get('/export/csv', requireAdmin, adminController.exportMembersCSV);

module.exports = router;
