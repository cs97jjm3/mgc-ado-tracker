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
  synced_at TEXT,
  
  -- Rich text fields for search & tagging
  acceptance_criteria TEXT,
  repro_steps TEXT,
  system_info TEXT,
  
  -- Planning & priority
  priority INTEGER,
  severity TEXT,
  story_points REAL,
  business_value INTEGER,
  risk TEXT,
  
  -- Version/build info
  found_in_build TEXT,
  integration_build TEXT,
  
  -- Workflow tracking
  resolved_by TEXT,
  resolved_date TEXT,
  closed_by TEXT,
  closed_date TEXT,
  activated_by TEXT,
  activated_date TEXT,
  state_reason TEXT,
  
  -- Effort tracking
  original_estimate REAL,
  remaining_work REAL,
  completed_work REAL,
  
  -- ADO native tags
  ado_tags TEXT,
  
  -- AI tagging flag
  needs_tagging INTEGER DEFAULT 1
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
  link_comment TEXT,
  FOREIGN KEY(source_id) REFERENCES work_items(ado_id),
  FOREIGN KEY(target_id) REFERENCES work_items(ado_id)
);

CREATE TABLE IF NOT EXISTS work_item_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_item_id TEXT,
  name TEXT,
  url TEXT,
  created_by TEXT,
  created_date TEXT,
  FOREIGN KEY(work_item_id) REFERENCES work_items(ado_id)
);

CREATE TABLE IF NOT EXISTS work_item_hyperlinks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_item_id TEXT,
  url TEXT,
  comment TEXT,
  FOREIGN KEY(work_item_id) REFERENCES work_items(ado_id)
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
CREATE INDEX IF NOT EXISTS idx_priority ON work_items(priority);
CREATE INDEX IF NOT EXISTS idx_story_points ON work_items(story_points);
CREATE INDEX IF NOT EXISTS idx_needs_tagging ON work_items(needs_tagging);
`;

// Migration: Add needs_tagging column if it doesn't exist
function migrateNeedsTaggingColumn() {
  try {
    // Check if column exists
    const result = db.exec(`
      PRAGMA table_info(work_items)
    `);
    
    const columns = result[0]?.values || [];
    const hasNeedsTagging = columns.some(col => col[1] === 'needs_tagging');
    
    if (!hasNeedsTagging) {
      // Add column with default value of 1 for items without tags
      db.exec(`
        ALTER TABLE work_items 
        ADD COLUMN needs_tagging INTEGER DEFAULT 1
      `);
      
      // Set needs_tagging to 0 for items that already have tags
      db.exec(`
        UPDATE work_items 
        SET needs_tagging = 0 
        WHERE tags IS NOT NULL AND tags != '[]' AND tags != ''
      `);
      
      // Create index
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_needs_tagging ON work_items(needs_tagging)
      `);
      
      saveDatabase();
      console.error('Migration: Added needs_tagging column to work_items table');
    }
  } catch (error) {
    // Column might already exist, ignore error
    if (!error.message.includes('duplicate column')) {
      console.error('Migration error:', error.message);
    }
  }
}

// Migration: Ensure all required tables exist
function migrateMissingTables() {
  try {
    // Check and create sync_log table if missing
    const syncLogExists = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='sync_log'`);
    if (!syncLogExists || syncLogExists.length === 0 || !syncLogExists[0].values || syncLogExists[0].values.length === 0) {
      console.error('Migration: Creating missing sync_log table');
      db.exec(`
        CREATE TABLE IF NOT EXISTS sync_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sync_date TEXT,
          items_added INTEGER,
          items_updated INTEGER,
          items_deleted INTEGER,
          status TEXT,
          error_message TEXT,
          duration_ms INTEGER
        )
      `);
      saveDatabase();
      console.error('Migration: sync_log table created');
    }
    
    // Check and create user_settings table if missing
    const userSettingsExists = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='user_settings'`);
    if (!userSettingsExists || userSettingsExists.length === 0 || !userSettingsExists[0].values || userSettingsExists[0].values.length === 0) {
      console.error('Migration: Creating missing user_settings table');
      db.exec(`
        CREATE TABLE IF NOT EXISTS user_settings (
          key TEXT PRIMARY KEY,
          value TEXT,
          updated_at TEXT
        )
      `);
      saveDatabase();
      console.error('Migration: user_settings table created');
    }
  } catch (error) {
    console.error('Migration error (missing tables):', error.message);
  }
}

// Migration: Add retag backup columns for v1.4.0
function migrateRetagBackupColumns() {
  try {
    const result = db.exec(`PRAGMA table_info(work_items)`);
    const columns = result[0]?.values || [];
    const columnNames = columns.map(col => col[1]);
    
    const newColumns = [
      { name: 'tags_backup', type: 'TEXT' },
      { name: 'confidence_scores_backup', type: 'TEXT' },
      { name: 'backup_timestamp', type: 'TEXT' },
      { name: 'last_retagged_at', type: 'TEXT' }
    ];
    
    let migrated = false;
    for (const col of newColumns) {
      if (!columnNames.includes(col.name)) {
        try {
          db.exec(`ALTER TABLE work_items ADD COLUMN ${col.name} ${col.type}`);
          migrated = true;
        } catch (err) {
          console.error(`Migration: Error adding column ${col.name}:`, err.message);
        }
      }
    }
    
    if (migrated) {
      saveDatabase();
      console.error('Migration: Added retag backup columns to work_items table');
    }
  } catch (error) {
    console.error('Migration error (retag backup):', error.message);
  }
}

// Migration: Add enhanced fields for v1.3.0
function migrateEnhancedFields() {
  try {
    // Check if work_items table exists
    const tables = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='work_items'`);
    if (!tables || tables.length === 0 || !tables[0].values || tables[0].values.length === 0) {
      console.error('Migration: work_items table does not exist yet, skipping migration');
      return;
    }

    const result = db.exec(`PRAGMA table_info(work_items)`);
    if (!result || result.length === 0 || !result[0].values) {
      console.error('Migration: Cannot read work_items table info');
      return;
    }
    
    const columns = result[0].values || [];
    const columnNames = columns.map(col => col[1]);
    
    const newColumns = [
      { name: 'acceptance_criteria', type: 'TEXT' },
      { name: 'repro_steps', type: 'TEXT' },
      { name: 'system_info', type: 'TEXT' },
      { name: 'priority', type: 'INTEGER' },
      { name: 'severity', type: 'TEXT' },
      { name: 'story_points', type: 'REAL' },
      { name: 'business_value', type: 'INTEGER' },
      { name: 'risk', type: 'TEXT' },
      { name: 'found_in_build', type: 'TEXT' },
      { name: 'integration_build', type: 'TEXT' },
      { name: 'resolved_by', type: 'TEXT' },
      { name: 'resolved_date', type: 'TEXT' },
      { name: 'closed_by', type: 'TEXT' },
      { name: 'closed_date', type: 'TEXT' },
      { name: 'activated_by', type: 'TEXT' },
      { name: 'activated_date', type: 'TEXT' },
      { name: 'state_reason', type: 'TEXT' },
      { name: 'original_estimate', type: 'REAL' },
      { name: 'remaining_work', type: 'REAL' },
      { name: 'completed_work', type: 'REAL' },
      { name: 'ado_tags', type: 'TEXT' }
    ];
    
    let migrated = false;
    for (const col of newColumns) {
      if (!columnNames.includes(col.name)) {
        try {
          db.exec(`ALTER TABLE work_items ADD COLUMN ${col.name} ${col.type}`);
          migrated = true;
        } catch (err) {
          console.error(`Migration: Error adding column ${col.name}:`, err.message);
        }
      }
    }
    
    // Add link_comment to work_item_links if table exists
    const linksTables = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='work_item_links'`);
    if (linksTables && linksTables.length > 0 && linksTables[0].values && linksTables[0].values.length > 0) {
      const linksResult = db.exec(`PRAGMA table_info(work_item_links)`);
      if (linksResult && linksResult.length > 0 && linksResult[0].values) {
        const linksColumns = linksResult[0].values || [];
        const linksColumnNames = linksColumns.map(col => col[1]);
        
        if (!linksColumnNames.includes('link_comment')) {
          try {
            db.exec(`ALTER TABLE work_item_links ADD COLUMN link_comment TEXT`);
            migrated = true;
          } catch (err) {
            console.error('Migration: Error adding link_comment:', err.message);
          }
        }
      }
    }
    
    if (migrated) {
      // Create new indexes
      try {
        db.exec(`CREATE INDEX IF NOT EXISTS idx_priority ON work_items(priority)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_story_points ON work_items(story_points)`);
      } catch (err) {
        console.error('Migration: Error creating indexes:', err.message);
      }
      
      saveDatabase();
      console.error('Migration: Added enhanced fields to work_items table');
    }
  } catch (error) {
    console.error('Migration error:', error.message);
  }
}

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

    // Check if database exists
    const dbExists = fs.existsSync(DB_PATH);

    // Load existing database or create new
    if (dbExists) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
      
      // Run migrations on existing database
      migrateMissingTables();
      migrateNeedsTaggingColumn();
      migrateEnhancedFields();
      migrateRetagBackupColumns();
    } else {
      // Create brand new database with full schema
      db = new SQL.Database();
      db.exec(SCHEMA);
    }
    
    // Save database
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

export function vacuumDatabase() {
  try {
    const beforeSize = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;
    
    // VACUUM reclaims unused space
    db.exec('VACUUM');
    
    saveDatabase();
    
    const afterSize = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;
    const reclaimed = beforeSize - afterSize;
    
    return {
      success: true,
      beforeSizeMB: (beforeSize / (1024 * 1024)).toFixed(2),
      afterSizeMB: (afterSize / (1024 * 1024)).toFixed(2),
      reclaimedMB: (reclaimed / (1024 * 1024)).toFixed(2)
    };
  } catch (error) {
    console.error('Failed to vacuum database:', error);
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

export async function reloadDatabase() {
  try {
    console.error('Reloading database from disk...');
    
    if (!fs.existsSync(DB_PATH)) {
      throw new Error('Database file not found');
    }
    
    // Close existing database if open
    if (db) {
      db.close();
    }
    
    // Reload from disk
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
    
    console.error('Database reloaded successfully');
    return db;
  } catch (error) {
    console.error('Failed to reload database:', error);
    throw error;
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
