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
      photo_url = `/uploads/committee/${req.file.filename}`;
    } else if (req.body.photo_url) {
      photo_url = req.body.photo_url.trim();
    }

    const order = parseInt(display_order, 10) || 0;
    const active = is_active === false || is_active === 0 || is_active === '0' ? 0 : 1;

    const result = await db.query(
      `INSERT INTO central_committee (name, designation, photo_url, display_order, is_active) VALUES (?, ?, ?, ?, ?)`,
      [name.trim(), designation.trim(), photo_url, order, active]
    );

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
      // New file uploaded -> remove old file if present, store new path
      safeDeletePhotoFile(currentPhotoUrl);
      photo_url = `/uploads/committee/${req.file.filename}`;
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
 * Admin Endpoint: Delete committee member
 */
async function deleteMember(req, res) {
  try {
    const { id } = req.params;
    
    // Fetch member to delete photo file
    const currentRes = await db.query(`SELECT photo_url FROM central_committee WHERE id = ?`, [id]);
    if (currentRes.rows && currentRes.rows.length > 0) {
      safeDeletePhotoFile(currentRes.rows[0].photo_url);
    }

    await db.query(`DELETE FROM central_committee WHERE id = ?`, [id]);
    return res.json({
      success: true,
      message: 'Committee member deleted successfully.'
    });
  } catch (error) {
    console.error('[Delete Committee Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete committee member.'
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
      `SELECT id, name, designation, display_order, photo_url, is_active FROM central_committee ORDER BY display_order ASC`
    );
    const existing = existingRes.rows || [];

    const { COMMITTEE_POSITIONS, getReservedIdForOrder } = require('../utils/membershipIdGenerator');

    const links = COMMITTEE_POSITIONS.map(pos => {
      const reservedId = getReservedIdForOrder(pos.order);
      const match = existing.find(c => c.display_order === pos.order || c.designation.toLowerCase() === pos.title.toLowerCase());
      
      return {
        key: pos.key,
        title: pos.title,
        order: pos.order,
        reserved_id: reservedId,
        is_registered: !!match,
        member: match ? {
          id: match.id,
          name: match.name,
          photo_url: match.photo_url,
          is_active: match.is_active
        } : null,
        link: `/committee-register.html?position=${pos.key}`
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

    const isRegistered = existing.rows && existing.rows.length > 0;
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
 * Public Endpoint: Register/Submit details for a Central Committee position via link
 */
async function registerPositionMember(req, res) {
  try {
    const { positionKey, full_name, gender, island, contact_number, email, blood_group, present_address, permanent_address } = req.body;

    if (!positionKey || !full_name || !gender || !island || !contact_number || !email || !blood_group) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required (Name, Gender, Island, Contact, Email, Blood Group).'
      });
    }

    const { getPositionByKey, getReservedIdForOrder } = require('../utils/membershipIdGenerator');
    const pos = getPositionByKey(positionKey);
    if (!pos) {
      return res.status(400).json({ success: false, message: 'Invalid committee position link.' });
    }

    const reservedId = getReservedIdForOrder(pos.order);

    let photo_url = null;
    if (req.file) {
      photo_url = `/uploads/committee/${req.file.filename}`;
    } else if (req.body.photo_url) {
      photo_url = req.body.photo_url.trim();
    }

    // 1. Insert or update in `members` table
    const existingMember = await db.query(
      `SELECT id FROM members WHERE membership_id = ? OR email = ? OR contact_number = ? LIMIT 1`,
      [reservedId, email.trim(), contact_number.trim()]
    );

    let memberDbId = null;
    if (existingMember.rows && existingMember.rows.length > 0) {
      memberDbId = existingMember.rows[0].id;
      await db.query(
        `UPDATE members 
         SET membership_id = ?, full_name = ?, gender = ?, island = ?, contact_number = ?, email = ?, blood_group = ?, present_address = ?, permanent_address = ?, designation = ?, payment_status = 'PAID', registration_status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [reservedId, full_name.trim(), gender, island, contact_number.trim(), email.trim(), blood_group, present_address || null, permanent_address || null, pos.title, memberDbId]
      );
    } else {
      const ins = await db.query(
        `INSERT INTO members (membership_id, full_name, gender, island, contact_number, email, blood_group, present_address, permanent_address, designation, payment_status, registration_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAID', 'ACTIVE')`,
        [reservedId, full_name.trim(), gender, island, contact_number.trim(), email.trim(), blood_group, present_address || null, permanent_address || null, pos.title]
      );
      memberDbId = ins.insertId;
    }

    // 2. Insert or update in `central_committee` table
    const existingComm = await db.query(
      `SELECT id, photo_url FROM central_committee WHERE display_order = ? OR designation = ? LIMIT 1`,
      [pos.order, pos.title]
    );

    if (existingComm.rows && existingComm.rows.length > 0) {
      const commId = existingComm.rows[0].id;
      const finalPhoto = photo_url || existingComm.rows[0].photo_url;
      await db.query(
        `UPDATE central_committee 
         SET name = ?, designation = ?, photo_url = ?, display_order = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [full_name.trim(), pos.title, finalPhoto, pos.order, commId]
      );
    } else {
      await db.query(
        `INSERT INTO central_committee (name, designation, photo_url, display_order, is_active)
         VALUES (?, ?, ?, ?, 1)`,
        [full_name.trim(), pos.title, photo_url, pos.order]
      );
    }

    return res.status(201).json({
      success: true,
      message: `${pos.title} registration completed successfully!`,
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
        payment_status: 'PAID',
        registration_status: 'ACTIVE'
      }
    });
  } catch (error) {
    console.error('[Register Position Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to complete committee registration.' });
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
  registerPositionMember
};

