import bcrypt from 'bcrypt';
import { getDatabase, saveDatabase } from '../database/db.js';

const SALT_ROUNDS = 10;

/**
 * Initialize the users table in the database
 */
export function initializeUsersTable() {
  const db = getDatabase();
  
  try {
    // Create users table
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
    
    // Create index on username
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_username ON users(username)
    `);
    
    saveDatabase();
    
    // Check if admin user exists
    const adminExists = db.exec(`
      SELECT COUNT(*) as count FROM users WHERE role = 'admin'
    `)[0]?.values[0]?.[0] > 0;
    
    // Create default admin user if none exists
    if (!adminExists) {
      const defaultPassword = 'admin123'; // User should change this immediately
      const hashedPassword = bcrypt.hashSync(defaultPassword, SALT_ROUNDS);
      
      db.exec(`
        INSERT INTO users (username, password_hash, email, full_name, role, created_at, updated_at)
        VALUES (
          'admin',
          '${hashedPassword}',
          'admin@localhost',
          'Administrator',
          'admin',
          '${new Date().toISOString()}',
          '${new Date().toISOString()}'
        )
      `);
      
      saveDatabase();
      
      console.error('Default admin user created:');
      console.error('  Username: admin');
      console.error('  Password: admin123');
      console.error('  ⚠️  IMPORTANT: Change this password immediately after first login!');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error initializing users table:', error);
    throw error;
  }
}

/**
 * Authenticate a user with username and password
 * @param {string} username 
 * @param {string} password 
 * @returns {Object|null} User object without password if successful, null otherwise
 */
export function authenticateUser(username, password) {
  const db = getDatabase();
  
  try {
    const result = db.exec(`
      SELECT * FROM users WHERE username = '${username}' AND is_active = 1
    `);
    
    if (!result || result.length === 0 || !result[0].values || result[0].values.length === 0) {
      return null;
    }
    
    const columns = result[0].columns;
    const values = result[0].values[0];
    const user = {};
    
    columns.forEach((col, idx) => {
      user[col] = values[idx];
    });
    
    // Verify password
    const isValidPassword = bcrypt.compareSync(password, user.password_hash);
    
    if (!isValidPassword) {
      return null;
    }
    
    // Update last login
    db.exec(`
      UPDATE users SET last_login = '${new Date().toISOString()}' WHERE id = ${user.id}
    `);
    saveDatabase();
    
    // Remove password hash from returned user object
    delete user.password_hash;
    
    return user;
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

/**
 * Express middleware to require authentication
 */
export function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Load user from database
  const user = getUserById(req.session.userId);
  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'User not found or inactive' });
  }
  
  req.user = user;
  next();
}

/**
 * Express middleware to require admin role
 */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Get user by ID
 * @param {number} userId 
 * @returns {Object|null}
 */
export function getUserById(userId) {
  const db = getDatabase();
  
  try {
    const result = db.exec(`
      SELECT * FROM users WHERE id = ${userId}
    `);
    
    if (!result || result.length === 0 || !result[0].values || result[0].values.length === 0) {
      return null;
    }
    
    const columns = result[0].columns;
    const values = result[0].values[0];
    const user = {};
    
    columns.forEach((col, idx) => {
      user[col] = values[idx];
    });
    
    // Remove password hash
    delete user.password_hash;
    
    return user;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

/**
 * List all users
 * @returns {Array}
 */
export function listUsers() {
  const db = getDatabase();
  
  try {
    const result = db.exec(`
      SELECT id, username, email, full_name, role, is_active, created_at, last_login
      FROM users
      ORDER BY username
    `);
    
    if (!result || result.length === 0 || !result[0].values || result[0].values.length === 0) {
      return [];
    }
    
    const columns = result[0].columns;
    const users = result[0].values.map(row => {
      const user = {};
      columns.forEach((col, idx) => {
        user[col] = row[idx];
      });
      return user;
    });
    
    return users;
  } catch (error) {
    console.error('Error listing users:', error);
    return [];
  }
}

/**
 * Create a new user
 * @param {Object} userData 
 * @returns {Object}
 */
export function createUser(userData) {
  const db = getDatabase();
  const { username, password, email, fullName, role = 'user' } = userData;
  
  try {
    // Check if username exists
    const existing = db.exec(`
      SELECT COUNT(*) as count FROM users WHERE username = '${username}'
    `)[0]?.values[0]?.[0];
    
    if (existing > 0) {
      throw new Error('Username already exists');
    }
    
    // Hash password
    const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
    
    // Insert user
    const now = new Date().toISOString();
    db.exec(`
      INSERT INTO users (username, password_hash, email, full_name, role, is_active, created_at, updated_at)
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
    
    // Get the created user
    const result = db.exec(`
      SELECT id, username, email, full_name, role, is_active, created_at
      FROM users WHERE username = '${username}'
    `);
    
    const columns = result[0].columns;
    const values = result[0].values[0];
    const user = {};
    
    columns.forEach((col, idx) => {
      user[col] = values[idx];
    });
    
    return { success: true, user };
  } catch (error) {
    console.error('Error creating user:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update user
 * @param {number} userId 
 * @param {Object} updates 
 * @returns {Object}
 */
export function updateUser(userId, updates) {
  const db = getDatabase();
  const { email, fullName, role, isActive } = updates;
  
  try {
    const updateFields = [];
    
    if (email !== undefined) updateFields.push(`email = '${email}'`);
    if (fullName !== undefined) updateFields.push(`full_name = '${fullName}'`);
    if (role !== undefined) updateFields.push(`role = '${role}'`);
    if (isActive !== undefined) updateFields.push(`is_active = ${isActive ? 1 : 0}`);
    
    updateFields.push(`updated_at = '${new Date().toISOString()}'`);
    
    db.exec(`
      UPDATE users SET ${updateFields.join(', ')} WHERE id = ${userId}
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
 * @param {number} userId 
 * @returns {Object}
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
 * Change user password
 * @param {number} userId 
 * @param {string} oldPassword 
 * @param {string} newPassword 
 * @returns {Object}
 */
export function changePassword(userId, oldPassword, newPassword) {
  const db = getDatabase();
  
  try {
    // Get current user
    const result = db.exec(`SELECT password_hash FROM users WHERE id = ${userId}`);
    
    if (!result || result.length === 0 || !result[0].values || result[0].values.length === 0) {
      return { success: false, error: 'User not found' };
    }
    
    const currentHash = result[0].values[0][0];
    
    // Verify old password
    const isValidPassword = bcrypt.compareSync(oldPassword, currentHash);
    if (!isValidPassword) {
      return { success: false, error: 'Current password is incorrect' };
    }
    
    // Hash new password
    const newHash = bcrypt.hashSync(newPassword, SALT_ROUNDS);
    
    // Update password
    db.exec(`
      UPDATE users 
      SET password_hash = '${newHash}', updated_at = '${new Date().toISOString()}'
      WHERE id = ${userId}
    `);
    
    saveDatabase();
    
    return { success: true };
  } catch (error) {
    console.error('Error changing password:', error);
    return { success: false, error: error.message };
  }
}
