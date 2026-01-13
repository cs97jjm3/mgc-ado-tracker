import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.ado-tracker', 'database.db');
const BACKUP_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.ado-tracker', 'backups');

let db = null;
let SQL = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS work_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ado_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  work_item_type TEXT,
  state TEXT,
  area_path TEXT,
  iteration_path TEXT,
  assigned_to TEXT,
  created_by TEXT,
  created_date TEXT,
  modified_date TEXT,
  tags TEXT,
  confidence_scores TEXT,
  project_name TEXT,
  raw_data TEXT,
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tag_name TEXT UNIQUE NOT NULL,
  usage_count INTEGER DEFAULT 0,
  category TEXT
);

CREATE TABLE IF NOT EXISTS work_item_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT,
  target_id TEXT,
  link_type TEXT,
  created_at TEXT,
  FOREIGN KEY(source_id) REFERENCES work_items(ado_id),
  FOREIGN KEY(target_id) REFERENCES work_items(ado_id)
);

CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_date TEXT,
  items_added INTEGER,
  items_updated INTEGER,
  items_deleted INTEGER,
  status TEXT,
  error_message TEXT,
  duration_ms INTEGER
);

CREATE TABLE IF NOT EXISTS user_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_ado_id ON work_items(ado_id);
CREATE INDEX IF NOT EXISTS idx_tags ON work_items(tags);
CREATE INDEX IF NOT EXISTS idx_title ON work_items(title);
CREATE INDEX IF NOT EXISTS idx_area ON work_items(area_path);
CREATE INDEX IF NOT EXISTS idx_iteration ON work_items(iteration_path);
CREATE INDEX IF NOT EXISTS idx_state ON work_items(state);
CREATE INDEX IF NOT EXISTS idx_type ON work_items(work_item_type);
CREATE INDEX IF NOT EXISTS idx_created_date ON work_items(created_date);
CREATE INDEX IF NOT EXISTS idx_modified_date ON work_items(modified_date);
`;

export async function initDatabase() {
  try {
    // Ensure directories exist
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Initialize SQL.js
    SQL = await initSqlJs();

    // Load existing database or create new
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    // Create schema
    db.run(SCHEMA);
    
    // Save initial database
    saveDatabase();
    
    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function saveDatabase() {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (error) {
    console.error('Failed to save database:', error);
    throw error;
  }
}

export function backupDatabase() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}.db`);
    
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(backupPath, buffer);
    
    // Clean old backups (keep last 7 days)
    cleanOldBackups();
    
    return backupPath;
  } catch (error) {
    console.error('Failed to backup database:', error);
    throw error;
  }
}

function cleanOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const backups = files
      .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
      .map(f => ({
        name: f,
        path: path.join(BACKUP_DIR, f),
        time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    // Keep last 7 backups
    const toDelete = backups.slice(7);
    toDelete.forEach(backup => {
      fs.unlinkSync(backup.path);
    });
  } catch (error) {
    console.error('Failed to clean old backups:', error);
  }
}

export function getDatabaseStats() {
  const db = getDatabase();
  
  const itemCount = db.exec('SELECT COUNT(*) as count FROM work_items')[0]?.values[0]?.[0] || 0;
  const tagCount = db.exec('SELECT COUNT(*) as count FROM tags')[0]?.values[0]?.[0] || 0;
  const linkCount = db.exec('SELECT COUNT(*) as count FROM work_item_links')[0]?.values[0]?.[0] || 0;
  
  const lastSync = db.exec('SELECT sync_date FROM sync_log ORDER BY sync_date DESC LIMIT 1')[0]?.values[0]?.[0] || null;
  
  const dbSize = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;
  const dbSizeMB = (dbSize / (1024 * 1024)).toFixed(2);
  
  return {
    itemCount,
    tagCount,
    linkCount,
    lastSync,
    dbSize,
    dbSizeMB,
    dbPath: DB_PATH
  };
}

export { DB_PATH, BACKUP_DIR };
