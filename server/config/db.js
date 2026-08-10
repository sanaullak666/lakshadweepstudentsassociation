const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

let pool = null;
let sqliteDb = null;
let dbType = process.env.DB_TYPE || 'mysql';

function getDbConnectionParams() {
  const dbUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;
  if (dbUrl) {
    try {
      const parsed = new URL(dbUrl);
      const rawDb = parsed.pathname ? parsed.pathname.replace(/^\//, '') : '';
      const dbName = (rawDb && rawDb !== 'sys') ? rawDb : 'lsa_membership';
      return {
        host: parsed.hostname,
        port: parseInt(parsed.port, 10) || 4000,
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        database: dbName,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false }
      };
    } catch (err) {
      console.warn('[DB URL Warning] Failed to parse DATABASE_URL, using individual env variables.');
    }
  }

  return {
    host: process.env.DB_HOST || 'gateway01.us-west-2.prod.aws.tidbcloud.com',
    port: parseInt(process.env.DB_PORT, 10) || 4000,
    user: process.env.DB_USER || '2wE8pt6cEdhXT96.root',
    password: process.env.DB_PASSWORD || 'AkSCcQC0MGCq1EpV',
    database: process.env.DB_NAME || 'lsa_membership',
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false }
  };
}

async function initDatabase() {
  const params = getDbConnectionParams();

  try {
    // 1. Try connection to server root/sys to create target database if needed
    try {
      const rootConfig = { ...params };
      delete rootConfig.database;
      const rootConnection = await mysql.createConnection(rootConfig);
      await rootConnection.query(`CREATE DATABASE IF NOT EXISTS \`${params.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
      await rootConnection.end();
    } catch (e) {
      // Ignore database creation error if DB exists or using default database
    }

    // 2. Create connection pool for specified database
    pool = mysql.createPool({
      host: params.host,
      port: params.port,
      user: params.user,
      password: params.password,
      database: params.database,
      ssl: params.ssl,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test connection
    const connection = await pool.getConnection();
    console.log(`[DB] Successfully connected to TiDB Cloud MySQL database: ${params.database} at ${params.host}:${params.port}`);
    connection.release();

    // Ensure tables exist
    await createMySQLTables();
    await seedDefaultAdminAndCommittee();
    dbType = 'mysql';
    return true;
  } catch (err) {
    console.warn(`[DB Warning] TiDB/MySQL connection failed (${err.message}). Falling back to embedded SQLite database...`);
    dbType = 'sqlite';
    return initSQLite();
  }
}

async function createMySQLTables() {
  const schemaPath = path.join(__dirname, '../../database/schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.toLowerCase().startsWith('create database') && !s.toLowerCase().startsWith('use '));

    for (const statement of statements) {
      try {
        await pool.query(statement);
      } catch (e) {
        // Ignore table exists errors
      }
    }
  }

  try {
    await pool.query(`ALTER TABLE central_committee MODIFY COLUMN photo_url LONGTEXT DEFAULT NULL`);
  } catch (e) {
    try {
      await pool.query(`ALTER TABLE central_committee ADD COLUMN photo_url LONGTEXT DEFAULT NULL`);
    } catch (err) {}
  }

  try {
    await pool.query(`ALTER TABLE central_committee ADD COLUMN access_password VARCHAR(255) DEFAULT NULL`);
  } catch (e) {}

  try {
    await pool.query(`ALTER TABLE members ADD COLUMN present_address TEXT DEFAULT NULL`);
  } catch (e) {}

  try {
    await pool.query(`ALTER TABLE members ADD COLUMN permanent_address TEXT DEFAULT NULL`);
  } catch (e) {}
}

function initSQLite() {
  return new Promise((resolve, reject) => {
    const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION;
    let dbDir = isVercel ? '/tmp' : path.join(__dirname, '../../data');
    
    if (!isVercel && !fs.existsSync(dbDir)) {
      try {
        fs.mkdirSync(dbDir, { recursive: true });
      } catch (err) {
        dbDir = '/tmp';
      }
    }
    
    const dbPath = path.join(dbDir, 'lsa_membership.sqlite');
    sqliteDb = new sqlite3.Database(dbPath, async (err) => {
      if (err) {
        console.error('[DB Error] Failed to initialize SQLite fallback:', err);
        return reject(err);
      }
      console.log(`[DB] Connected to SQLite database at ${dbPath}`);
      try {
        await createSQLiteTables();
        await seedDefaultAdminAndCommittee();
      } catch (e) {
        console.warn('[DB Init Warning]', e.message);
      }
      resolve(true);
    });
  });
}

function createSQLiteTables() {
  return new Promise((resolve, reject) => {
    sqliteDb.serialize(() => {
      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS central_committee (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          designation TEXT NOT NULL,
          photo_url TEXT DEFAULT NULL,
          display_order INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          access_password TEXT DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      sqliteDb.run(`ALTER TABLE central_committee ADD COLUMN photo_url TEXT DEFAULT NULL`, (err) => {});
      sqliteDb.run(`ALTER TABLE central_committee ADD COLUMN access_password TEXT DEFAULT NULL`, (err) => {});

      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS members (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          membership_id TEXT UNIQUE DEFAULT NULL,
          full_name TEXT NOT NULL,
          gender TEXT NOT NULL,
          island TEXT NOT NULL,
          contact_number TEXT NOT NULL,
          email TEXT NOT NULL,
          blood_group TEXT NOT NULL,
          present_address TEXT DEFAULT NULL,
          permanent_address TEXT DEFAULT NULL,
          designation TEXT DEFAULT 'Member',
          payment_status TEXT DEFAULT 'PENDING',
          registration_status TEXT DEFAULT 'PENDING',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      sqliteDb.run(`ALTER TABLE members ADD COLUMN present_address TEXT DEFAULT NULL`, (err) => {});
      sqliteDb.run(`ALTER TABLE members ADD COLUMN permanent_address TEXT DEFAULT NULL`, (err) => {});
      sqliteDb.run(`ALTER TABLE members ADD COLUMN designation TEXT DEFAULT 'Member'`, (err) => {});

      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          member_id INTEGER NOT NULL,
          order_id TEXT NOT NULL,
          payment_id TEXT DEFAULT NULL,
          amount REAL NOT NULL DEFAULT 3.00,
          currency TEXT NOT NULL DEFAULT 'INR',
          status TEXT DEFAULT 'PENDING',
          payment_method TEXT DEFAULT 'razorpay',
          paid_at DATETIME DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (member_id) REFERENCES members(id)
        );
      `);

      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS admins (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          full_name TEXT NOT NULL,
          role TEXT DEFAULT 'admin',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

async function seedDefaultAdminAndCommittee() {
  try {

    // Seed Admin if empty
    const adminEmail = process.env.ADMIN_EMAIL || 'lakshadweepstudentsassociation@gmail.com';
    const adminPass = process.env.ADMIN_PASSWORD || 'LSA@Admin2026';
    const adminCount = await executeQuery('SELECT COUNT(*) as count FROM admins WHERE email = ?', [adminEmail]);
    const adminVal = adminCount.rows[0]?.count || adminCount.rows[0]?.['COUNT(*)'] || 0;

    if (adminVal === 0) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(adminPass, salt);
      await executeQuery(
        'INSERT INTO admins (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
        [adminEmail, hash, 'LSA Admin', 'super_admin']
      );
      console.log(`[DB Seed] Seeded default admin: ${adminEmail}`);
    }

    // Seed/Update access_password for Central Committee positions if missing, and clean up duplicate position rows
    const { COMMITTEE_POSITIONS, getReservedIdForOrder } = require('../utils/membershipIdGenerator');
    for (const pos of COMMITTEE_POSITIONS) {
      const existing = await executeQuery(
        'SELECT id, access_password FROM central_committee WHERE display_order = ? OR designation = ? ORDER BY id ASC',
        [pos.order, pos.title]
      );
      if (existing.rows && existing.rows.length > 0) {
        const keepId = existing.rows[0].id;
        // Clean up duplicate rows for the same designation or display order
        if (existing.rows.length > 1) {
          for (let i = 1; i < existing.rows.length; i++) {
            await executeQuery('DELETE FROM central_committee WHERE id = ?', [existing.rows[i].id]);
          }
        }
        if (!existing.rows[0].access_password) {
          await executeQuery('UPDATE central_committee SET access_password = ? WHERE id = ?', [pos.defaultPassword, keepId]);
        }
      } else {
        await executeQuery(
          'INSERT INTO central_committee (name, designation, display_order, is_active, access_password) VALUES (?, ?, ?, 1, ?)',
          [pos.title, pos.title, pos.order, pos.defaultPassword]
        );
      }

      // Ensure Central Committee positions also exist in members table
      const reservedId = getReservedIdForOrder(pos.order);
      const mCheck = await executeQuery(
        'SELECT id FROM members WHERE membership_id = ? OR designation = ? LIMIT 1',
        [reservedId, pos.title]
      );
      if (!mCheck.rows || mCheck.rows.length === 0) {
        await executeQuery(
          `INSERT INTO members (membership_id, full_name, gender, island, contact_number, email, blood_group, designation, payment_status, registration_status)
           VALUES (?, ?, 'Male', 'Kavaratti', '0000000000', ?, 'O+', ?, 'PENDING', 'PENDING')`,
          [reservedId, pos.title, `${pos.key}@lsa.org.in`, pos.title]
        );
      }
    }
  } catch (err) {
    console.error('[DB Seed Error]', err.message);
  }
}

async function executeQuery(sql, params = []) {
  if (dbType === 'mysql' && pool) {
    try {
      const [rows] = await pool.query(sql, params);
      return {
        rows: Array.isArray(rows) ? rows : [],
        insertId: rows ? rows.insertId : null,
        affectedRows: rows ? rows.affectedRows : 0
      };
    } catch (err) {
      if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
        console.warn('[DB Connection Warning] Re-initializing pool due to stale connection...');
        await initDatabase();
        const [rows] = await pool.query(sql, params);
        return {
          rows: Array.isArray(rows) ? rows : [],
          insertId: rows ? rows.insertId : null,
          affectedRows: rows ? rows.affectedRows : 0
        };
      }
      throw err;
    }
  } else if (sqliteDb) {
    return new Promise((resolve, reject) => {
      const trimmed = sql.trim().toUpperCase();
      if (trimmed.startsWith('SELECT')) {
        sqliteDb.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve({ rows: rows || [], insertId: null, affectedRows: 0 });
        });
      } else {
        sqliteDb.run(sql, params, function (err) {
          if (err) return reject(err);
          resolve({
            rows: [],
            insertId: this.lastID,
            affectedRows: this.changes
          });
        });
      }
    });
  } else {
    throw new Error('Database not initialized.');
  }
}

module.exports = {
  initDatabase,
  query: executeQuery,
  getDbType: () => dbType
};
