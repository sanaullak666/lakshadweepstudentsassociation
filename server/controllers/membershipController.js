const db = require('../config/db');

/**
 * Handles initial registration form submission
 */
async function register(req, res) {
  try {
    const body = req.sanitizedBody || req.body;
    const { full_name, gender, island, contact_number, email, blood_group, present_address, permanent_address } = body;
    const designation = (body.designation || 'Member').trim() || 'Member';
    const wantsPhysicalCard = (body.wants_physical_card === true || body.wants_physical_card === 1 || body.wants_physical_card === '1' || body.wants_physical_card === 'true') ? 1 : 0;

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
        isDuplicate: true,
        membershipId: match.membership_id,
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
        `UPDATE members SET full_name = ?, gender = ?, island = ?, blood_group = ?, present_address = ?, permanent_address = ?, designation = ?, wants_physical_card = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [full_name, gender, island, blood_group, present_address || null, permanent_address || null, designation, wantsPhysicalCard, memberId]
      );
    } else {
      // Insert new member record with PENDING status
      const insertResult = await db.query(
        `INSERT INTO members (full_name, gender, island, contact_number, email, blood_group, present_address, permanent_address, designation, wants_physical_card, payment_status, registration_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'PENDING')`,
        [full_name, gender, island, contact_number, email, blood_group, present_address || null, permanent_address || null, designation, wantsPhysicalCard]
      );
      memberId = insertResult.insertId;
    }

    const calculatedAmount = wantsPhysicalCard === 1 ? 150.00 : 23.00;

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
        wants_physical_card: wantsPhysicalCard,
        amount: calculatedAmount,
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
      `SELECT id, membership_id, full_name, gender, island, contact_number, email, blood_group, present_address, permanent_address, designation, wants_physical_card, payment_status, registration_status, created_at 
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
      `SELECT membership_id, full_name, gender, island, blood_group, designation, registration_status, created_at 
       FROM members 
       WHERE membership_id = ? AND registration_status = 'ACTIVE' LIMIT 1`,
      [cleanId]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or inactive Membership ID. No active record found.'
      });
    }

    const member = result.rows[0];

    // Profile photo is strictly reserved for Central Committee members (LSA-2026-00001 to LSA-2026-00009)
    const seqNum = parseInt(cleanId.split('-')[2], 10);
    const isCentralCommittee = !isNaN(seqNum) && seqNum >= 1 && seqNum <= 9;

    let photoUrl = null;
    if (isCentralCommittee) {
      const cRes = await db.query(
        `SELECT photo_url FROM central_committee WHERE display_order = ? LIMIT 1`,
        [seqNum]
      );
      if (cRes.rows && cRes.rows.length > 0) {
        photoUrl = cRes.rows[0].photo_url;
      }
    }

    return res.json({
      success: true,
      message: 'Valid LSA Membership',
      data: {
        membership_id: member.membership_id,
        full_name: member.full_name,
        gender: member.gender,
        island: member.island,
        blood_group: member.blood_group,
        photo_url: photoUrl,
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
async function checkDuplicate(req, res) {
  try {
    const { email, phone } = req.query;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phone || '').replace(/[\s\-\+]/g, '').replace(/^91/, '');

    if (!cleanEmail && !cleanPhone) {
      return res.json({ success: true, exists: false });
    }

    const check = await db.query(
      `SELECT id, membership_id, full_name, payment_status, registration_status FROM members 
       WHERE (email = ? AND ? != '') OR (contact_number = ? AND ? != '') LIMIT 1`,
      [cleanEmail, cleanEmail, cleanPhone, cleanPhone]
    );

    if (check.rows && check.rows.length > 0) {
      const match = check.rows[0];
      return res.json({
        success: true,
        exists: true,
        membershipId: match.membership_id,
        fullName: match.full_name,
        paymentStatus: match.payment_status,
        message: `An account already exists with this contact information (Membership ID: ${match.membership_id || 'Registered'}).`
      });
    }

    return res.json({ success: true, exists: false });
  } catch (error) {
    return res.json({ success: true, exists: false });
  }
}

module.exports = {
  register,
  getMemberById,
  verifyPublic,
  checkDuplicate
};
