const db = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * Admin Login
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const envAdminEmail = (process.env.ADMIN_EMAIL || 'lakshadweepstudentsassociation@gmail.com').trim().toLowerCase();
    const envAdminPass = process.env.ADMIN_PASSWORD || 'LSA@Admin2026';

    let isMatched = false;
    let adminRecord = null;

    // 1. Check database for existing admin user
    try {
      const result = await db.query(`SELECT * FROM admins WHERE email = ?`, [cleanEmail]);
      if (result.rows && result.rows.length > 0) {
        adminRecord = result.rows[0];
        isMatched = await bcrypt.compare(password, adminRecord.password_hash);
      }
    } catch (e) {
      console.warn('[Admin DB Query Warning]', e.message);
    }

    // 2. Direct env fallback matching for super admin
    if (!isMatched && cleanEmail === envAdminEmail && password === envAdminPass) {
      isMatched = true;
      adminRecord = {
        id: 1,
        email: envAdminEmail,
        full_name: 'LSA Administrator',
        role: 'super_admin'
      };

      // Ensure record is synced to DB
      try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(envAdminPass, salt);
        await db.query(
          `INSERT INTO admins (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)`,
          [envAdminEmail, hash, 'LSA Administrator', 'super_admin']
        );
      } catch (e) {}
    }

    if (!isMatched || !adminRecord) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Set Session & Token
    const token = crypto.randomBytes(32).toString('hex');
    const { registerAdminToken } = require('../middleware/auth');
    registerAdminToken(token);

    if (req.session) {
      req.session.admin = {
        id: adminRecord.id,
        email: adminRecord.email,
        full_name: adminRecord.full_name,
        role: adminRecord.role || 'super_admin'
      };
      req.session.adminToken = token;
    }

    return res.json({
      success: true,
      message: 'Login successful.',
      data: {
        admin: {
          id: adminRecord.id,
          email: adminRecord.email,
          full_name: adminRecord.full_name
        },
        token
      }
    });
  } catch (error) {
    console.error('[Admin Login Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed. Please try again.'
    });
  }
}

/**
 * Admin Logout
 */
function logout(req, res) {
  if (req.session) {
    req.session.destroy();
  }
  return res.json({
    success: true,
    message: 'Logged out successfully.'
  });
}

/**
 * Get Current Admin Profile
 */
function getMe(req, res) {
  if (req.session && req.session.admin) {
    return res.json({
      success: true,
      data: req.session.admin
    });
  }

  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (token) {
    return res.json({
      success: true,
      data: {
        email: process.env.ADMIN_EMAIL || 'admin@lsa.org.in',
        full_name: 'LSA Administrator',
        role: 'super_admin'
      }
    });
  }

  return res.status(401).json({ success: false, message: 'Not authenticated' });
}

/**
 * Admin Dashboard Stats
 */
async function getStats(req, res) {
  try {
    // Count real registered human members (excluding vacant position placeholders)
    const totalMembersRes = await db.query(
      `SELECT COUNT(*) as count FROM members WHERE contact_number != '0000000000'`,
      []
    );
    const paidMembersRes = await db.query(
      `SELECT COUNT(*) as count FROM members WHERE payment_status = 'PAID' AND contact_number != '0000000000'`,
      []
    );
    const pendingPaymentsRes = await db.query(
      `SELECT COUNT(*) as count FROM members WHERE payment_status = 'PENDING' AND contact_number != '0000000000'`,
      []
    );
    const activeCommitteeRes = await db.query(
      `SELECT COUNT(*) as count FROM central_committee WHERE is_active = 1`,
      []
    );

    const totalMembers = totalMembersRes.rows[0]?.count || totalMembersRes.rows[0]?.['COUNT(*)'] || 0;
    const paidMembers = paidMembersRes.rows[0]?.count || paidMembersRes.rows[0]?.['COUNT(*)'] || 0;
    const pendingPayments = pendingPaymentsRes.rows[0]?.count || pendingPaymentsRes.rows[0]?.['COUNT(*)'] || 0;
    const activeCommittee = activeCommitteeRes.rows[0]?.count || activeCommitteeRes.rows[0]?.['COUNT(*)'] || 0;

    // Island distribution
    const islandRes = await db.query(
      `SELECT island, COUNT(*) as count FROM members WHERE payment_status = 'PAID' AND contact_number != '0000000000' GROUP BY island`,
      []
    );
    
    return res.json({
      success: true,
      data: {
        totalMembers,
        paidMembers,
        pendingPayments,
        activeCommittee,
        islandStats: islandRes.rows || []
      }
    });
  } catch (error) {
    console.error('[Admin Stats Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch admin stats.'
    });
  }
}

/**
 * View Members with filters & search
 */
async function getMembers(req, res) {
  try {
    const { search, island, blood_group, gender, payment_status } = req.query;

    let sql = `SELECT id, membership_id, full_name, gender, island, contact_number, email, blood_group, designation, payment_status, registration_status, created_at FROM members WHERE 1=1`;
    const params = [];

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      sql += ` AND (membership_id LIKE ? OR full_name LIKE ? OR email LIKE ? OR contact_number LIKE ?)`;
      params.push(q, q, q, q);
    }

    if (island && island.trim()) {
      sql += ` AND island = ?`;
      params.push(island.trim());
    }

    if (blood_group && blood_group.trim()) {
      sql += ` AND blood_group = ?`;
      params.push(blood_group.trim());
    }

    if (gender && gender.trim()) {
      sql += ` AND gender = ?`;
      params.push(gender.trim());
    }

    if (payment_status && payment_status.trim()) {
      sql += ` AND payment_status = ?`;
      params.push(payment_status.trim());
    }

    sql += ` ORDER BY CASE WHEN membership_id IS NULL OR membership_id = '' THEN 1 ELSE 0 END, membership_id ASC, id ASC`;

    const result = await db.query(sql, params);

    return res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('[Get Members Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve members list.'
    });
  }
}

/**
 * View Payments History
 */
async function getPayments(req, res) {
  try {
    const sql = `
      SELECT 
        COALESCE(p.id, 0) as id,
        m.id as member_id,
        COALESCE(p.order_id, 'ORDER_PENDING') as order_id,
        p.payment_id,
        COALESCE(p.amount, CASE WHEN m.wants_physical_card = 1 THEN 150.00 ELSE 3.00 END) as amount,
        COALESCE(p.currency, 'INR') as currency,
        COALESCE(p.status, m.payment_status) as status,
        COALESCE(p.payment_method, 'upi') as payment_method,
        p.paid_at,
        COALESCE(p.created_at, m.created_at) as created_at,
        m.full_name,
        m.email,
        m.contact_number,
        m.island,
        m.membership_id,
        m.wants_physical_card
      FROM members m
      LEFT JOIN payments p ON p.member_id = m.id
      WHERE m.contact_number != '0000000000' AND (p.id IS NOT NULL OR m.payment_status = 'PENDING')
      ORDER BY COALESCE(p.id, 0) DESC, m.id DESC
    `;
    const result = await db.query(sql, []);

    return res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('[Get Payments Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve payments history.'
    });
  }
}

/**
 * Admin Endpoint: Approve UTR / Payment and activate member membership ID
 */
async function approvePayment(req, res) {
  try {
    const { paymentId, memberId } = req.body;

    let targetMemberId = memberId;
    let targetPaymentId = paymentId;

    if (!targetMemberId && targetPaymentId) {
      const pRes = await db.query(`SELECT member_id FROM payments WHERE id = ? OR payment_id = ? OR order_id = ? LIMIT 1`, [targetPaymentId, targetPaymentId, targetPaymentId]);
      if (pRes.rows && pRes.rows.length > 0) {
        targetMemberId = pRes.rows[0].member_id;
      }
    }

    if (!targetMemberId) {
      return res.status(400).json({ success: false, message: 'Member ID or Payment ID is required.' });
    }

    const { generateMembershipId } = require('../utils/membershipIdGenerator');

    // Fetch member
    const memberRes = await db.query(
      `SELECT id, full_name, email, membership_id, payment_status, wants_physical_card FROM members WHERE id = ?`,
      [targetMemberId]
    );

    if (!memberRes.rows || memberRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    const member = memberRes.rows[0];
    let finalMembershipId = member.membership_id;

    if (!finalMembershipId || finalMembershipId.startsWith('PENDING')) {
      finalMembershipId = await generateMembershipId();
    }

    // 1. Update or Insert payments table
    const pCheck = await db.query(`SELECT id FROM payments WHERE member_id = ? OR id = ?`, [targetMemberId, targetPaymentId || 0]);
    if (pCheck.rows && pCheck.rows.length > 0) {
      await db.query(
        `UPDATE payments SET status = 'PAID', paid_at = CURRENT_TIMESTAMP WHERE member_id = ? OR id = ?`,
        [targetMemberId, targetPaymentId || 0]
      );
    } else {
      const amt = (member.wants_physical_card === 1 || member.wants_physical_card === true) ? 150.00 : 3.00;
      await db.query(
        `INSERT INTO payments (member_id, order_id, payment_id, amount, currency, status, payment_method, paid_at)
         VALUES (?, ?, ?, ?, 'INR', 'PAID', 'admin_approved', CURRENT_TIMESTAMP)`,
        [targetMemberId, `ADMIN_APPROVED_${targetMemberId}_${Date.now()}`, 'ADMIN_VERIFIED', amt]
      );
    }

    // 2. Update members table
    await db.query(
      `UPDATE members SET payment_status = 'PAID', registration_status = 'ACTIVE', membership_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [finalMembershipId, targetMemberId]
    );

    return res.json({
      success: true,
      message: `Payment approved! Membership ID issued: ${finalMembershipId}`,
      data: {
        memberId: targetMemberId,
        membershipId: finalMembershipId,
        payment_status: 'PAID',
        registration_status: 'ACTIVE'
      }
    });
  } catch (error) {
    console.error('[Approve Payment Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to approve payment.' });
  }
}

/**
 * Admin Endpoint: Reject payment / invalid UTR
 */
async function rejectPayment(req, res) {
  try {
    const { paymentId, memberId } = req.body;

    let targetMemberId = memberId;
    let targetPaymentId = paymentId;

    if (!targetMemberId && targetPaymentId) {
      const pRes = await db.query(`SELECT member_id FROM payments WHERE id = ? OR payment_id = ? OR order_id = ? LIMIT 1`, [targetPaymentId, targetPaymentId, targetPaymentId]);
      if (pRes.rows && pRes.rows.length > 0) {
        targetMemberId = pRes.rows[0].member_id;
      }
    }

    if (!targetMemberId) {
      return res.status(400).json({ success: false, message: 'Member ID or Payment ID is required.' });
    }

    const pCheck = await db.query(`SELECT id FROM payments WHERE member_id = ? OR id = ?`, [targetMemberId, targetPaymentId || 0]);
    if (pCheck.rows && pCheck.rows.length > 0) {
      await db.query(
        `UPDATE payments SET status = 'FAILED' WHERE member_id = ? OR id = ?`,
        [targetMemberId, targetPaymentId || 0]
      );
    } else {
      await db.query(
        `INSERT INTO payments (member_id, order_id, payment_id, amount, currency, status, payment_method)
         VALUES (?, ?, ?, 3.00, 'INR', 'FAILED', 'admin_rejected')`,
        [targetMemberId, `ADMIN_REJECTED_${targetMemberId}`, 'REJECTED']
      );
    }

    await db.query(
      `UPDATE members SET payment_status = 'FAILED', registration_status = 'INACTIVE', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [targetMemberId]
    );

    return res.json({
      success: true,
      message: 'Payment status marked as rejected/failed.'
    });
  } catch (error) {
    console.error('[Reject Payment Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to reject payment.' });
  }
}

/**
 * Export Members to CSV
 */
async function exportMembersCSV(req, res) {
  try {
    const result = await db.query(
      `SELECT membership_id, full_name, gender, island, contact_number, email, blood_group, designation, payment_status, created_at FROM members ORDER BY id DESC`,
      []
    );

    const headers = [
      'Membership ID',
      'Full Name',
      'Gender',
      'Island',
      'Contact Number',
      'Email',
      'Blood Group',
      'Designation',
      'Payment Status',
      'Registration Date'
    ];

    let csvContent = headers.join(',') + '\n';

    for (const member of result.rows) {
      const row = [
        `"${member.membership_id || 'PENDING'}"`,
        `"${(member.full_name || '').replace(/"/g, '""')}"`,
        `"${member.gender || ''}"`,
        `"${member.island || ''}"`,
        `"${member.contact_number || ''}"`,
        `"${member.email || ''}"`,
        `"${member.blood_group || ''}"`,
        `"${(member.designation || 'Member').replace(/"/g, '""')}"`,
        `"${member.payment_status || 'PENDING'}"`,
        `"${new Date(member.created_at).toISOString().split('T')[0]}"`
      ];
      csvContent += row.join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=LSA_Members_Export_${new Date().toISOString().split('T')[0]}.csv`);
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error('[Export CSV Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate CSV export.'
    });
  }
}

/**
 * Admin Endpoint: Update Member Profile Details
 */
async function updateMember(req, res) {
  try {
    const { id } = req.params;
    const { full_name, gender, island, contact_number, email, blood_group, designation, payment_status, membership_id } = req.body;

    if (!full_name || !email || !contact_number) {
      return res.status(400).json({ success: false, message: 'Full name, email, and contact number are required.' });
    }

    // Check member exists
    const current = await db.query(`SELECT id, membership_id FROM members WHERE id = ?`, [id]);
    if (!current.rows || current.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    let finalMembershipId = membership_id ? membership_id.trim() : current.rows[0].membership_id;
    const cleanPayStatus = (payment_status || 'PENDING').toUpperCase();
    const cleanRegStatus = cleanPayStatus === 'PAID' ? 'ACTIVE' : 'PENDING';

    // If changing to PAID and no membership ID yet, generate one
    if (cleanPayStatus === 'PAID' && (!finalMembershipId || finalMembershipId === 'PENDING')) {
      const { generateMembershipId } = require('../utils/membershipIdGenerator');
      finalMembershipId = await generateMembershipId();
    }

    await db.query(
      `UPDATE members 
       SET full_name = ?, gender = ?, island = ?, contact_number = ?, email = ?, blood_group = ?, designation = ?, payment_status = ?, registration_status = ?, membership_id = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [full_name.trim(), gender, island, contact_number.trim(), email.trim(), blood_group, designation || 'Member', cleanPayStatus, cleanRegStatus, finalMembershipId, id]
    );

    // If payment status was updated to PAID, update payments table status as well
    if (cleanPayStatus === 'PAID') {
      await db.query(`UPDATE payments SET status = 'PAID', paid_at = CURRENT_TIMESTAMP WHERE member_id = ?`, [id]);
    }

    return res.json({
      success: true,
      message: 'Member details updated successfully.',
      data: {
        id,
        full_name,
        email,
        membership_id: finalMembershipId,
        payment_status: cleanPayStatus
      }
    });
  } catch (error) {
    console.error('[Update Member Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to update member profile.' });
  }
}

/**
 * Admin Endpoint: Delete Member from Database
 */
async function deleteMember(req, res) {
  try {
    const { id } = req.params;

    const current = await db.query(`SELECT id, full_name, designation FROM members WHERE id = ?`, [id]);
    if (!current.rows || current.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    // Delete linked payments
    try {
      await db.query(`DELETE FROM payments WHERE member_id = ?`, [id]);
    } catch (e) {}

    // Delete member
    await db.query(`DELETE FROM members WHERE id = ?`, [id]);

    return res.json({
      success: true,
      message: 'Member record deleted from database successfully.'
    });
  } catch (error) {
    console.error('[Delete Member Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to delete member from database.' });
  }
}

module.exports = {
  login,
  logout,
  getMe,
  getStats,
  getMembers,
  getPayments,
  approvePayment,
  rejectPayment,
  updateMember,
  deleteMember,
  exportMembersCSV
};
