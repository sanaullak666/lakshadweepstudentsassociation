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
    const result = await db.query(`SELECT * FROM admins WHERE email = ?`, [cleanEmail]);

    if (!result.rows || result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const admin = result.rows[0];
    const isMatch = await bcrypt.compare(password, admin.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Set Session & Token
    const token = crypto.randomBytes(32).toString('hex');
    const { registerAdminToken } = require('../middleware/auth');
    registerAdminToken(token);

    req.session.admin = {
      id: admin.id,
      email: admin.email,
      full_name: admin.full_name,
      role: admin.role
    };
    req.session.adminToken = token;

    return res.json({
      success: true,
      message: 'Login successful.',
      data: {
        admin: {
          id: admin.id,
          email: admin.email,
          full_name: admin.full_name
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
    const totalMembersRes = await db.query(`SELECT COUNT(*) as count FROM members`, []);
    const paidMembersRes = await db.query(`SELECT COUNT(*) as count FROM members WHERE payment_status = 'PAID'`, []);
    const pendingPaymentsRes = await db.query(`SELECT COUNT(*) as count FROM members WHERE payment_status = 'PENDING'`, []);
    const activeCommitteeRes = await db.query(`SELECT COUNT(*) as count FROM central_committee WHERE is_active = 1`, []);

    const totalMembers = totalMembersRes.rows[0]?.count || totalMembersRes.rows[0]?.['COUNT(*)'] || 0;
    const paidMembers = paidMembersRes.rows[0]?.count || paidMembersRes.rows[0]?.['COUNT(*)'] || 0;
    const pendingPayments = pendingPaymentsRes.rows[0]?.count || pendingPaymentsRes.rows[0]?.['COUNT(*)'] || 0;
    const activeCommittee = activeCommitteeRes.rows[0]?.count || activeCommitteeRes.rows[0]?.['COUNT(*)'] || 0;

    // Island distribution
    const islandRes = await db.query(`SELECT island, COUNT(*) as count FROM members WHERE payment_status = 'PAID' GROUP BY island`, []);
    
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

    sql += ` ORDER BY id DESC`;

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
      SELECT p.id, p.member_id, p.order_id, p.payment_id, p.amount, p.currency, p.status, p.payment_method, p.paid_at, p.created_at,
             m.full_name, m.email, m.membership_id
      FROM payments p
      LEFT JOIN members m ON p.member_id = m.id
      ORDER BY p.id DESC
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

module.exports = {
  login,
  logout,
  getMe,
  getStats,
  getMembers,
  getPayments,
  exportMembersCSV
};
