const express = require('express');
const router = express.Router();
const committeeController = require('../controllers/committeeController');
const { requireAdmin } = require('../middleware/auth');
const { handleCommitteePhotoUpload } = require('../middleware/upload');

// Public route: Get active central committee
router.get('/', committeeController.getActiveCommittee);
router.get('/position-info/:positionKey', committeeController.getCommitteePositionInfo);
router.post('/verify-role-password', committeeController.verifyRolePassword);
router.post('/register-position', handleCommitteePhotoUpload, committeeController.registerPositionMember);

// Protected Admin routes
router.get('/links', requireAdmin, committeeController.getCommitteeLinks);
router.post('/update-role-password', requireAdmin, committeeController.updateRolePassword);
router.get('/all', requireAdmin, committeeController.getAllCommittee);
router.post('/', requireAdmin, handleCommitteePhotoUpload, committeeController.addMember);
router.put('/:id', requireAdmin, handleCommitteePhotoUpload, committeeController.updateMember);
router.delete('/:id', requireAdmin, committeeController.deleteMember);
router.patch('/:id/toggle', requireAdmin, committeeController.toggleActive);

module.exports = router;

