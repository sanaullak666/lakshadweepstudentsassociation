const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

let pool = null;
let sqliteDb = null;
let dbType = process.env.DB_TYPE || 'mysql';

async function initDatabase() {
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'lsa_membership';

  try {
    // 1. Try MySQL root connection to create database if needed
    const rootConnection = await mysql.createConnection({
      host,
      port,
      user,
      password
    });

    await rootConnection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await rootConnection.end();

    // 2. Create connection pool for specified database
    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test connection
    const connection = await pool.getConnection();
    console.log(`[DB] Successfully connected to MySQL database: ${database}`);
    connection.release();

    // Ensure tables exist
    await createMySQLTables();
    await seedDefaultAdminAndCommittee();
    dbType = 'mysql';
    return true;
  } catch (err) {
    console.warn(`[DB Warning] MySQL connection failed (${err.message}). Falling back to embedded SQLite database...`);
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
    await pool.query(`ALTER TABLE central_committee ADD COLUMN photo_url VARCHAR(500) DEFAULT NULL`);
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
    const dbDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.join(dbDir, 'lsa_membership.sqlite');
    sqliteDb = new sqlite3.Database(dbPath, async (err) => {
      if (err) {
        console.error('[DB Error] Failed to initialize SQLite fallback:', err);
        return reject(err);
      }
      console.log(`[DB] Connected to SQLite database at ${dbPath}`);
      await createSQLiteTables();
      await seedDefaultAdminAndCommittee();
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
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      sqliteDb.run(`ALTER TABLE central_committee ADD COLUMN photo_url TEXT DEFAULT NULL`, (err) => {});

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
  } catch (err) {
    console.error('[DB Seed Error]', err.message);
  }
}

async function executeQuery(sql, params = []) {
  if (dbType === 'mysql' && pool) {
    const [rows, fields] = await pool.execute(sql, params);
    return {
      rows,
      insertId: rows.insertId,
      affectedRows: rows.affectedRows
    };
  } else if (sqliteDb) {
    return new Promise((resolve, reject) => {
      const trimmed = sql.trim().toUpperCase();
      if (trimmed.startsWith('SELECT')) {
        sqliteDb.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve({ rows, insertId: null, affectedRows: 0 });
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
