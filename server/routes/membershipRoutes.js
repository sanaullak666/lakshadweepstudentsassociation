const express = require('express');
const router = express.Router();
const membershipController = require('../controllers/membershipController');
const { validateRegistration } = require('../middleware/validation');

// POST /api/membership/register - Multi-step registration submission
router.post('/register', validateRegistration, membershipController.register);


// GET /api/membership/verify/:membershipId - Public verification endpoint
router.get('/verify/:membershipId', membershipController.verifyPublic);

// GET /api/membership/:id - Get registration details by ID
router.get('/:id', membershipController.getMemberById);

module.exports = router;
