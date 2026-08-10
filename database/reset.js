const db = require('../server/config/db');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function wipeAllDatabaseData() {
  console.log('[Wipe] Cleaning ALL data from members, payments, and central_committee tables...');

  try {
    // 1. Initialize DB connection
    await db.initDatabase();

    // 2. Delete all records from payments, members, and central_committee
    await db.query('DELETE FROM payments', []);
    await db.query('DELETE FROM members', []);
    await db.query('DELETE FROM central_committee', []);
    await db.query('DELETE FROM admins', []);

    console.log('[Wipe] Successfully cleared members, payments, and central_committee tables.');

    // Delete all uploaded committee photos from disk
    const uploadDir = path.join(__dirname, '../public/uploads/committee');
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(uploadDir, file));
        } catch (e) {}
      }
      console.log(`[Wipe] Cleared ${files.length} uploaded photo files.`);
    }

    // 3. Re-create Admin account only
    const adminEmail = process.env.ADMIN_EMAIL || 'lakshadweepstudentsassociation@gmail.com';
    const adminPass = process.env.ADMIN_PASSWORD || 'LSA@Admin2026';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(adminPass, salt);

    await db.query(
      'INSERT INTO admins (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      [adminEmail, hash, 'LSA Administrator', 'super_admin']
    );
    console.log(`[Wipe] Admin account initialized: ${adminEmail}`);

    console.log('[Wipe Success] All database data wiped clean! Committee list is now empty.');
    process.exit(0);
  } catch (err) {
    console.error('[Wipe Error]', err);
    process.exit(1);
  }
}

wipeAllDatabaseData();
