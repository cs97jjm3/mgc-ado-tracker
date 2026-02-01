import bcrypt from 'bcrypt';
import { getDatabase, saveDatabase } from '../database/db.js';

const SALT_ROUNDS = 10;

/**
 * Initialize the users table in the database
 */
export function initializeUsersTable() {
  const db = getDatabase();

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT,
        full_name TEXT,
        role TEXT DEFAULT 'user',
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_login TEXT
      )
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_username ON users(username)
    `);

    saveDatabase();

    const adminExists =
      db.exec(`SELECT COUNT(*) FROM users WHERE role = 'admin'`)[0]?.values[0]?.[0] > 0;

    if (!adminExists) {
      const defaultPassword = 'admin123';
      const hashedPassword = bcrypt.hashSync(defaultPassword, SALT_ROUNDS);
      const now = new Date().toISOString();

      db.exec(`
        INSERT INTO users (
          username,
          password_hash,
          email,
          full_name,
          role,
          created_at,
          updated_at
        )
        VALUES (
          'admin',
          '${hashedPassword}',
          'admin@localhost',
          'Administrator',
          'admin',
          '${now}',
          '${now}'
        )
      `);

      saveDatabase();

      console.error('Default admin user created');
      console.error('Username: admin');
      console.error('Password: admin123');
    }

    return { success: true };
  } catch (error) {
    console.error('Error initializing users table:', error);
    throw error;
  }
}

/**
 * Authenticate a user
 */
export function authenticateUser(username, password) {
  const db = getDatabase();

  try {
    const result = db.exec(`
      SELECT * FROM users WHERE username = '${username}' AND is_active = 1
    `);

    if (!result?.[0]?.values?.length) {
      return null;
    }

    const columns = result[0].columns;
    const values = result[0].values[0];
    const user = {};

    columns.forEach((col, idx) => {
      user[col] = values[idx];
    });

    if (!bcrypt.compareSync(password, user.password_hash)) {
      return null;
    }

    db.exec(`
      UPDATE users
      SET last_login = '${new Date().toISOString()}'
      WHERE id = ${user.id}
    `);
    saveDatabase();

    delete user.password_hash;
    return user;
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

/**
 * Middleware: require authentication
 */
export function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = getUserById(req.session.userId);
  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'User not found or inactive' });
  }

  req.user = user;
  next();
}

/**
 * Middleware: require admin
 */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Get user by ID
 */
export function getUserById(userId) {
  const db = getDatabase();

  try {
    const result = db.exec(`SELECT * FROM users WHERE id = ${userId}`);
    if (!result?.[0]?.values?.length) {
      return null;
    }

    const columns = result[0].columns;
    const values = result[0].values[0];
    const user = {};

    columns.forEach((col, idx) => {
      user[col] = values[idx];
    });

    delete user.password_hash;
    return user;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

/**
 * List all users
 */
export function listUsers() {
  const db = getDatabase();

  try {
    const result = db.exec(`
      SELECT id, username, email, full_name, role, is_active, created_at, last_login
      FROM users
      ORDER BY username
    `);

    if (!result?.[0]?.values?.length) {
      return [];
    }

    const columns = result[0].columns;
    return result[0].values.map(row => {
      const user = {};
      columns.forEach((col, idx) => {
        user[col] = row[idx];
      });
      return user;
    });
  } catch (error) {
    console.error('Error listing users:', error);
    return [];
  }
}

/**
 * Create a new user (password REQUIRED)
 */
export function createUser(userData) {
  const db = getDatabase();
  const { username, password, email, fullName, role = 'user' } = userData;

  try {
    if (!password || password.trim() === '') {
      throw new Error('Password is required');
    }

    const existing =
      db.exec(`SELECT COUNT(*) FROM users WHERE username = '${username}'`)[0]?.values[0]?.[0];

    if (existing > 0) {
      throw new Error('Username already exists');
    }

    const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
    const now = new Date().toISOString();

    db.exec(`
      INSERT INTO users (
        username,
        password_hash,
        email,
        full_name,
        role,
        is_active,
        created_at,
        updated_at
      )
      VALUES (
        '${username}',
        '${passwordHash}',
        '${email || ''}',
        '${fullName || ''}',
        '${role}',
        1,
        '${now}',
        '${now}'
      )
    `);

    saveDatabase();
    return { success: true };
  } catch (error) {
    console.error('Error creating user:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update user (NO password here)
 */
export function updateUser(userId, updates) {
  const db = getDatabase();
  const { email, fullName, role, isActive } = updates;

  try {
    const fields = [];

    if (email !== undefined) fields.push(`email = '${email}'`);
    if (fullName !== undefined) fields.push(`full_name = '${fullName}'`);
    if (role !== undefined) fields.push(`role = '${role}'`);
    if (isActive !== undefined) fields.push(`is_active = ${isActive ? 1 : 0}`);

    fields.push(`updated_at = '${new Date().toISOString()}'`);

    db.exec(`
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = ${userId}
    `);

    saveDatabase();
    return { success: true };
  } catch (error) {
    console.error('Error updating user:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete user
 */
export function deleteUser(userId) {
  const db = getDatabase();

  try {
    db.exec(`DELETE FROM users WHERE id = ${userId}`);
    saveDatabase();
    return { success: true };
  } catch (error) {
    console.error('Error deleting user:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Change password (ONLY place passwords change)
 * If oldPassword is empty string, skip verification (admin changing another user's password)
 */
export function changePassword(userId, oldPassword, newPassword) {
  const db = getDatabase();

  try {
    const result = db.exec(`
      SELECT password_hash FROM users WHERE id = ${userId}
    `);

    if (!result?.[0]?.values?.length) {
      return { success: false, error: 'User not found' };
    }

    const currentHash = result[0].values[0][0];

    // Only verify old password if provided (not empty string)
    if (oldPassword && !bcrypt.compareSync(oldPassword, currentHash)) {
      return { success: false, error: 'Current password is incorrect' };
    }

    const newHash = bcrypt.hashSync(newPassword, SALT_ROUNDS);

    db.exec(`
      UPDATE users
      SET password_hash = '${newHash}',
          updated_at = '${new Date().toISOString()}'
      WHERE id = ${userId}
    `);

    saveDatabase();
    return { success: true };
  } catch (error) {
    console.error('Error changing password:', error);
    return { success: false, error: error.message };
  }
}
