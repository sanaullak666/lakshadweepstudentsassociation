const db = require('../config/db');
const fs = require('fs');
const path = require('path');

/**
 * Helper to delete photo file from disk if stored locally
 */
function safeDeletePhotoFile(photoUrl) {
  if (!photoUrl || typeof photoUrl !== 'string') return;
  if (photoUrl.startsWith('/uploads/committee/')) {
    const filename = photoUrl.replace('/uploads/committee/', '');
    const filePath = path.join(__dirname, '../../public/uploads/committee', filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.warn('[File Warning] Failed to delete old photo file:', filePath, e.message);
      }
    }
  }
}

/**
 * Helper to get Data URL or URL from uploaded file
 */
function getPhotoUrlFromFile(file, fallbackUrl = null) {
  if (file && file.buffer) {
    const mimeType = file.mimetype || 'image/jpeg';
    return `data:${mimeType};base64,${file.buffer.toString('base64')}`;
  }
  return fallbackUrl;
}

/**
 * Public Endpoint: Get active Central Committee members
 */
async function getActiveCommittee(req, res) {
  try {
    const result = await db.query(
      `SELECT id, name, designation, photo_url, display_order FROM central_committee 
       WHERE is_active = 1 
       ORDER BY display_order ASC, id ASC`
    );

    return res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('[Get Committee Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch committee members.'
    });
  }
}

/**
 * Admin Endpoint: Get all Central Committee members (including inactive)
 */
async function getAllCommittee(req, res) {
  try {
    const result = await db.query(
      `SELECT id, name, designation, photo_url, display_order, is_active, created_at, updated_at 
       FROM central_committee 
       ORDER BY display_order ASC, id ASC`
    );

    return res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('[Get All Committee Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch committee list.'
    });
  }
}

async function syncCommitteeMemberToMembersTable(name, designation, displayOrder) {
  if (!name || name === designation) return;
  try {
    const { getReservedIdForOrder } = require('../utils/membershipIdGenerator');
    const reservedId = getReservedIdForOrder(displayOrder);

    const existing = await db.query(
      `SELECT id FROM members WHERE membership_id = ? OR designation = ? OR full_name = ? LIMIT 1`,
      [reservedId, designation, name]
    );

    if (existing.rows && existing.rows.length > 0) {
      await db.query(
        `UPDATE members 
         SET full_name = ?, designation = ?, membership_id = ?, payment_status = 'PAID', registration_status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [name, designation, reservedId, existing.rows[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO members (membership_id, full_name, gender, island, contact_number, email, blood_group, designation, payment_status, registration_status)
         VALUES (?, ?, 'Specified', 'Kavaratti', '9999999999', ?, 'O+', ?, 'PAID', 'ACTIVE')`,
        [reservedId, name, `${designation.toLowerCase().replace(/[^a-z0-9]/g, '')}@lsa.org`, designation]
      );
    }
  } catch (e) {
    console.warn('[Sync Member Warning]', e.message);
  }
}

/**
 * Admin Endpoint: Add new committee member
 */
async function addMember(req, res) {
  try {
    const { name, designation, display_order, is_active } = req.body;

    if (!name || !designation) {
      return res.status(400).json({
        success: false,
        message: 'Name and designation are required.'
      });
    }

    let photo_url = null;
    if (req.file) {
      photo_url = getPhotoUrlFromFile(req.file);
    } else if (req.body.photo_url) {
      photo_url = req.body.photo_url.trim();
    }

    const order = parseInt(display_order, 10) || 0;
    const active = is_active === false || is_active === 0 || is_active === '0' ? 0 : 1;

    const result = await db.query(
      `INSERT INTO central_committee (name, designation, photo_url, display_order, is_active) VALUES (?, ?, ?, ?, ?)`,
      [name.trim(), designation.trim(), photo_url, order, active]
    );

    if (active) {
      await syncCommitteeMemberToMembersTable(name.trim(), designation.trim(), order);
    }

    return res.status(201).json({
      success: true,
      message: 'Committee member added successfully.',
      data: {
        id: result.insertId,
        name,
        designation,
        photo_url,
        display_order: order,
        is_active: active
      }
    });
  } catch (error) {
    console.error('[Add Committee Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add committee member.'
    });
  }
}

/**
 * Admin Endpoint: Update committee member
 */
async function updateMember(req, res) {
  try {
    const { id } = req.params;
    const { name, designation, display_order, is_active, remove_photo } = req.body;

    if (!name || !designation) {
      return res.status(400).json({
        success: false,
        message: 'Name and designation are required.'
      });
    }

    // Fetch existing member data to check current photo
    const currentRes = await db.query(`SELECT photo_url FROM central_committee WHERE id = ?`, [id]);
    if (!currentRes.rows || currentRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Committee member not found.' });
    }

    const currentPhotoUrl = currentRes.rows[0].photo_url;
    let photo_url = currentPhotoUrl;

    if (req.file) {
      // New file uploaded -> store base64 data URL
      safeDeletePhotoFile(currentPhotoUrl);
      photo_url = getPhotoUrlFromFile(req.file);
    } else if (remove_photo === 'true' || remove_photo === true || remove_photo === 1 || remove_photo === '1') {
      // Requested photo removal
      safeDeletePhotoFile(currentPhotoUrl);
      photo_url = null;
    } else if (req.body.photo_url !== undefined && req.body.photo_url !== currentPhotoUrl) {
      photo_url = req.body.photo_url ? req.body.photo_url.trim() : null;
    }

    const order = parseInt(display_order, 10) || 0;
    const active = is_active === false || is_active === 0 || is_active === '0' ? 0 : 1;

    await db.query(
      `UPDATE central_committee 
       SET name = ?, designation = ?, photo_url = ?, display_order = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [name.trim(), designation.trim(), photo_url, order, active, id]
    );

    if (active) {
      await syncCommitteeMemberToMembersTable(name.trim(), designation.trim(), order);
    }

    return res.json({
      success: true,
      message: 'Committee member updated successfully.',
      data: {
        id,
        name,
        designation,
        photo_url,
        display_order: order,
        is_active: active
      }
    });
  } catch (error) {
    console.error('[Update Committee Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update committee member.'
    });
  }
}

/**
 * Admin Endpoint: Delete committee member and wipe profile from database
 */
async function deleteMember(req, res) {
  try {
    const { id } = req.params;
    
    // 1. Fetch member details from central_committee
    const currentRes = await db.query(
      `SELECT id, name, designation, display_order, photo_url FROM central_committee WHERE id = ?`,
      [id]
    );

    if (!currentRes.rows || currentRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Committee member not found.' });
    }

    const commMember = currentRes.rows[0];
    safeDeletePhotoFile(commMember.photo_url);

    const { getReservedIdForOrder } = require('../utils/membershipIdGenerator');
    const reservedId = getReservedIdForOrder(commMember.display_order);

    // 2. Delete linked records from `members` and `payments` tables
    const memberRes = await db.query(
      `SELECT id FROM members WHERE membership_id = ? OR designation = ? OR full_name = ?`,
      [reservedId, commMember.designation, commMember.name]
    );

    if (memberRes.rows && memberRes.rows.length > 0) {
      for (const m of memberRes.rows) {
        try {
          await db.query(`DELETE FROM payments WHERE member_id = ?`, [m.id]);
        } catch (e) {}
        await db.query(`DELETE FROM members WHERE id = ?`, [m.id]);
      }
    } else {
      await db.query(
        `DELETE FROM members WHERE membership_id = ? OR designation = ? OR full_name = ?`,
        [reservedId, commMember.designation, commMember.name]
      );
    }

    // 3. Reset core position or delete from `central_committee` table
    if (commMember.display_order >= 1 && commMember.display_order <= 9) {
      await db.query(
        `UPDATE central_committee SET name = designation, photo_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [id]
      );
    } else {
      await db.query(`DELETE FROM central_committee WHERE id = ?`, [id]);
    }

    return res.json({
      success: true,
      message: 'Committee member removed from Committee Management and Members Directory.'
    });
  } catch (error) {
    console.error('[Delete Committee Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete committee member from database.'
    });
  }
}

/**
 * Admin Endpoint: Toggle active status
 */
async function toggleActive(req, res) {
  try {
    const { id } = req.params;
    const currentResult = await db.query(`SELECT is_active FROM central_committee WHERE id = ?`, [id]);

    if (!currentResult.rows || currentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    const newStatus = currentResult.rows[0].is_active ? 0 : 1;
    await db.query(`UPDATE central_committee SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [newStatus, id]);

    return res.json({
      success: true,
      message: `Committee member ${newStatus ? 'activated' : 'deactivated'}.`,
      is_active: newStatus
    });
  } catch (error) {
    console.error('[Toggle Committee Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update status.'
    });
  }
}

/**
 * Admin Endpoint: Get 9 Central Committee registration links and status
 */
async function getCommitteeLinks(req, res) {
  try {
    const existingRes = await db.query(
      `SELECT id, name, designation, display_order, photo_url, is_active, access_password FROM central_committee ORDER BY display_order ASC`
    );
    const existing = existingRes.rows || [];

    const { COMMITTEE_POSITIONS, getReservedIdForOrder } = require('../utils/membershipIdGenerator');

    const links = COMMITTEE_POSITIONS.map(pos => {
      const reservedId = getReservedIdForOrder(pos.order);
      const match = existing.find(c => c.display_order === pos.order || c.designation.toLowerCase() === pos.title.toLowerCase());
      const accessPass = match && match.access_password ? match.access_password : pos.defaultPassword;
      
      return {
        key: pos.key,
        title: pos.title,
        order: pos.order,
        reserved_id: reservedId,
        access_password: accessPass,
        is_registered: !!match && match.name !== pos.title,
        member: match ? {
          id: match.id,
          name: match.name,
          photo_url: match.photo_url,
          is_active: match.is_active
        } : null,
        link: `/committee-register?position=${pos.key}`
      };
    });

    return res.json({
      success: true,
      data: links
    });
  } catch (error) {
    console.error('[Get Committee Links Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch committee links.' });
  }
}

/**
 * Public Endpoint: Get position details by key for registration page
 */
async function getCommitteePositionInfo(req, res) {
  try {
    const { positionKey } = req.params;
    const { getPositionByKey, getReservedIdForOrder } = require('../utils/membershipIdGenerator');
    const pos = getPositionByKey(positionKey);

    if (!pos) {
      return res.status(404).json({ success: false, message: 'Invalid Central Committee position.' });
    }

    const reservedId = getReservedIdForOrder(pos.order);
    
    // Check if position is already registered in central_committee
    const existing = await db.query(
      `SELECT id, name, photo_url FROM central_committee WHERE display_order = ? OR designation = ? LIMIT 1`,
      [pos.order, pos.title]
    );

    const isRegistered = existing.rows && existing.rows.length > 0 && existing.rows[0].name !== pos.title;
    const currentMember = isRegistered ? existing.rows[0] : null;

    return res.json({
      success: true,
      data: {
        key: pos.key,
        title: pos.title,
        order: pos.order,
        reserved_id: reservedId,
        is_registered: isRegistered,
        current_member: currentMember
      }
    });
  } catch (error) {
    console.error('[Get Position Info Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch position information.' });
  }
}

/**
 * Public Endpoint: Verify position role password before unlocking registration form
 */
async function verifyRolePassword(req, res) {
  try {
    const { positionKey, password } = req.body;

    if (!positionKey || !password) {
      return res.status(400).json({ success: false, message: 'Position key and password are required.' });
    }

    const { getPositionByKey, getReservedIdForOrder } = require('../utils/membershipIdGenerator');
    const pos = getPositionByKey(positionKey);

    if (!pos) {
      return res.status(404).json({ success: false, message: 'Invalid Central Committee position.' });
    }

    const reservedId = getReservedIdForOrder(pos.order);

    // Fetch password from central_committee table
    const existingComm = await db.query(
      `SELECT id, name, designation, photo_url, access_password FROM central_committee WHERE display_order = ? OR designation = ? LIMIT 1`,
      [pos.order, pos.title]
    );

    let expectedPassword = pos.defaultPassword;
    let commMatch = null;
    if (existingComm.rows && existingComm.rows.length > 0) {
      commMatch = existingComm.rows[0];
      if (commMatch.access_password) {
        expectedPassword = commMatch.access_password;
      }
    }

    if (password.trim() !== expectedPassword.trim()) {
      return res.status(401).json({ success: false, message: 'Incorrect Access Password for this position.' });
    }

    // Password matches -> fetch full member details if registered
    const existingMember = await db.query(
      `SELECT id, membership_id, full_name, gender, island, contact_number, email, blood_group, present_address, permanent_address, designation 
       FROM members 
       WHERE membership_id = ? OR designation = ? LIMIT 1`,
      [reservedId, pos.title]
    );

    let memberData = null;
    if (existingMember.rows && existingMember.rows.length > 0) {
      memberData = {
        ...existingMember.rows[0],
        photo_url: commMatch ? commMatch.photo_url : null
      };
    } else if (commMatch && commMatch.name && commMatch.name !== pos.title) {
      memberData = {
        full_name: commMatch.name,
        photo_url: commMatch.photo_url,
        designation: pos.title
      };
    }

    return res.json({
      success: true,
      message: 'Access granted.',
      data: {
        key: pos.key,
        title: pos.title,
        order: pos.order,
        reserved_id: reservedId,
        is_registered: !!memberData,
        member: memberData
      }
    });
  } catch (error) {
    console.error('[Verify Role Password Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to verify position access password.' });
  }
}

/**
 * Admin Endpoint: Update access password for a Central Committee role
 */
async function updateRolePassword(req, res) {
  try {
    const { positionKey, newPassword } = req.body;

    if (!positionKey || !newPassword || !newPassword.trim()) {
      return res.status(400).json({ success: false, message: 'Position key and new password are required.' });
    }

    const { getPositionByKey } = require('../utils/membershipIdGenerator');
    const pos = getPositionByKey(positionKey);

    if (!pos) {
      return res.status(404).json({ success: false, message: 'Invalid Central Committee position.' });
    }

    const cleanPass = newPassword.trim();

    const existing = await db.query(
      `SELECT id FROM central_committee WHERE display_order = ? OR designation = ? LIMIT 1`,
      [pos.order, pos.title]
    );

    if (existing.rows && existing.rows.length > 0) {
      await db.query(
        `UPDATE central_committee SET access_password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [cleanPass, existing.rows[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO central_committee (name, designation, photo_url, display_order, is_active, access_password) VALUES (?, ?, NULL, ?, 1, ?)`,
        [pos.title, pos.title, pos.order, cleanPass]
      );
    }

    return res.json({
      success: true,
      message: `Access password for ${pos.title} updated successfully.`,
      data: {
        positionKey: pos.key,
        title: pos.title,
        access_password: cleanPass
      }
    });
  } catch (error) {
    console.error('[Update Role Password Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to update position password.' });
  }
}

/**
 * Public Endpoint: Register/Submit details for a Central Committee position via link
 */
async function registerPositionMember(req, res) {
  try {
    const { positionKey, password, full_name, gender, island, contact_number, email, blood_group, present_address, permanent_address } = req.body;

    if (!positionKey || !full_name || !gender || !island || !contact_number || !email || !blood_group) {
      return res.status(400).json({
        success: false,
        message: 'All mandatory fields are required (Name, Gender, Island, Contact, Email, Blood Group).'
      });
    }

    const { getPositionByKey, getReservedIdForOrder } = require('../utils/membershipIdGenerator');
    const pos = getPositionByKey(positionKey);
    if (!pos) {
      return res.status(400).json({ success: false, message: 'Invalid committee position link.' });
    }

    // Check Role Access Password
    const commRes = await db.query(
      `SELECT id, photo_url, access_password FROM central_committee WHERE display_order = ? OR designation = ? LIMIT 1`,
      [pos.order, pos.title]
    );

    let expectedPassword = pos.defaultPassword;
    let existingCommPhoto = null;
    let commId = null;

    if (commRes.rows && commRes.rows.length > 0) {
      commId = commRes.rows[0].id;
      existingCommPhoto = commRes.rows[0].photo_url;
      if (commRes.rows[0].access_password) {
        expectedPassword = commRes.rows[0].access_password;
      }
    }

    if (password && password.trim() !== expectedPassword.trim()) {
      return res.status(401).json({ success: false, message: 'Invalid access password for this role.' });
    }

    const reservedId = getReservedIdForOrder(pos.order);

    let photo_url = null;
    if (req.file) {
      photo_url = getPhotoUrlFromFile(req.file);
    } else if (req.body.photo_url && req.body.photo_url.trim()) {
      photo_url = req.body.photo_url.trim();
    } else if (existingCommPhoto) {
      photo_url = existingCommPhoto;
    }

    // 1. Insert or update in `members` table
    const existingMember = await db.query(
      `SELECT id, payment_status, registration_status FROM members WHERE membership_id = ? OR designation = ? OR email = ? OR contact_number = ? LIMIT 1`,
      [reservedId, pos.title, email.trim(), contact_number.trim()]
    );

    let memberDbId = null;
    let currentPaymentStatus = 'PENDING';
    let currentRegStatus = 'PENDING';

    if (existingMember.rows && existingMember.rows.length > 0) {
      memberDbId = existingMember.rows[0].id;
      currentPaymentStatus = existingMember.rows[0].payment_status || 'PENDING';
      currentRegStatus = existingMember.rows[0].registration_status || 'PENDING';

      await db.query(
        `UPDATE members 
         SET membership_id = ?, full_name = ?, gender = ?, island = ?, contact_number = ?, email = ?, blood_group = ?, present_address = ?, permanent_address = ?, designation = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [reservedId, full_name.trim(), gender, island, contact_number.trim(), email.trim(), blood_group, present_address || null, permanent_address || null, pos.title, memberDbId]
      );
    } else {
      const ins = await db.query(
        `INSERT INTO members (membership_id, full_name, gender, island, contact_number, email, blood_group, present_address, permanent_address, designation, payment_status, registration_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'PENDING')`,
        [reservedId, full_name.trim(), gender, island, contact_number.trim(), email.trim(), blood_group, present_address || null, permanent_address || null, pos.title]
      );
      memberDbId = ins.insertId;
    }

    // 2. Insert or update in `central_committee` table
    if (commId) {
      await db.query(
        `UPDATE central_committee 
         SET name = ?, designation = ?, photo_url = ?, display_order = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [full_name.trim(), pos.title, photo_url, pos.order, commId]
      );
    } else {
      await db.query(
        `INSERT INTO central_committee (name, designation, photo_url, display_order, is_active, access_password)
         VALUES (?, ?, ?, ?, 1, ?)`,
        [full_name.trim(), pos.title, photo_url, pos.order, expectedPassword]
      );
    }

    const needsPayment = currentPaymentStatus !== 'PAID';

    return res.status(200).json({
      success: true,
      message: needsPayment ? `${pos.title} profile saved! Please complete the ₹3.00 payment to activate your official pass.` : `${pos.title} profile updated successfully!`,
      data: {
        memberId: memberDbId,
        membership_id: reservedId,
        full_name: full_name.trim(),
        designation: pos.title,
        island,
        contact_number: contact_number.trim(),
        email: email.trim(),
        blood_group,
        photo_url,
        payment_status: currentPaymentStatus,
        registration_status: currentRegStatus,
        needsPayment
      }
    });
  } catch (error) {
    console.error('[Register Position Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to complete committee profile update.' });
  }
}

module.exports = {
  getActiveCommittee,
  getAllCommittee,
  addMember,
  updateMember,
  deleteMember,
  toggleActive,
  getCommitteeLinks,
  getCommitteePositionInfo,
  verifyRolePassword,
  updateRolePassword,
  registerPositionMember
};

