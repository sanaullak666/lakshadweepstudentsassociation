const db = require('../config/db');

/**
 * Handles initial registration form submission
 */
async function register(req, res) {
  try {
    const { full_name, gender, island, contact_number, email, blood_group, present_address, permanent_address } = req.sanitizedBody || req.body;
    const designation = ((req.sanitizedBody || req.body).designation || 'Member').trim() || 'Member';

    // Check for existing PAID / ACTIVE membership with same email or phone
    const existingCheck = await db.query(
      `SELECT id, payment_status, registration_status, membership_id FROM members 
       WHERE (email = ? OR contact_number = ?) AND (payment_status = 'PAID' OR registration_status = 'ACTIVE')`,
      [email, contact_number]
    );

    if (existingCheck.rows && existingCheck.rows.length > 0) {
      const match = existingCheck.rows[0];
      return res.status(409).json({
        success: false,
        message: `A registered LSA member already exists with this email or contact number (Membership ID: ${match.membership_id || 'Active'}).`
      });
    }

    // Check if there is an existing PENDING registration to reuse
    const pendingCheck = await db.query(
      `SELECT id FROM members WHERE email = ? AND contact_number = ? AND payment_status = 'PENDING'`,
      [email, contact_number]
    );

    let memberId;
    if (pendingCheck.rows && pendingCheck.rows.length > 0) {
      memberId = pendingCheck.rows[0].id;
      // Update existing pending record
      await db.query(
        `UPDATE members SET full_name = ?, gender = ?, island = ?, blood_group = ?, present_address = ?, permanent_address = ?, designation = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [full_name, gender, island, blood_group, present_address || null, permanent_address || null, designation, memberId]
      );
    } else {
      // Insert new member record with PENDING status
      const insertResult = await db.query(
        `INSERT INTO members (full_name, gender, island, contact_number, email, blood_group, present_address, permanent_address, designation, payment_status, registration_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'PENDING')`,
        [full_name, gender, island, contact_number, email, blood_group, present_address || null, permanent_address || null, designation]
      );
      memberId = insertResult.insertId;
    }

    return res.status(201).json({
      success: true,
      message: 'Registration details saved successfully.',
      data: {
        memberId,
        full_name,
        gender,
        island,
        contact_number,
        email,
        blood_group,
        present_address,
        permanent_address,
        designation,
        amount: 3.00,
        currency: 'INR'
      }
    });
  } catch (error) {
    console.error('[Register Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while processing registration. Please try again.'
    });
  }
}

/**
 * Gets registration summary for review step or success page
 */
async function getMemberById(req, res) {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT id, membership_id, full_name, gender, island, contact_number, email, blood_group, present_address, permanent_address, designation, payment_status, registration_status, created_at 
       FROM members WHERE id = ?`,
      [id]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member registration record not found.'
      });
    }

    return res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[Get Member Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve registration details.'
    });
  }
}

/**
 * Public Verification Endpoint - returns non-sensitive public info ONLY
 */
async function verifyPublic(req, res) {
  try {
    const { membershipId } = req.params;
    const cleanId = (membershipId || '').trim().toUpperCase();

    if (!cleanId) {
      return res.status(400).json({
        success: false,
        message: 'Membership ID is required.'
      });
    }

    const result = await db.query(
      `SELECT membership_id, full_name, island, designation, registration_status, created_at 
       FROM members WHERE membership_id = ? AND registration_status = 'ACTIVE'`,
      [cleanId]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or inactive Membership ID. No active record found.'
      });
    }

    const member = result.rows[0];
    return res.json({
      success: true,
      message: 'Valid LSA Membership',
      data: {
        membership_id: member.membership_id,
        full_name: member.full_name,
        island: member.island,
        designation: member.designation || 'Member',
        status: 'Active',
        validity_year: '2026'
      }
    });
  } catch (error) {
    console.error('[Verify Public Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify membership.'
    });
  }
}

module.exports = {
  register,
  getMemberById,
  verifyPublic
};
