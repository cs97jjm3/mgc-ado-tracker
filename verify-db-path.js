import initSqlJs from 'sql.js';
import fs from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const SQL = await initSqlJs();
const dbPath = join(homedir(), '.ado-tracker', 'database.db');

console.log('Database path:', dbPath);
console.log('Database exists:', fs.existsSync(dbPath));

if (fs.existsSync(dbPath)) {
  const stats = fs.statSync(dbPath);
  console.log('Database size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
  console.log('Last modified:', stats.mtime.toISOString());
  
  const db = new SQL.Database(fs.readFileSync(dbPath));
  
  // Quick check of actual data
  const totalItems = db.exec('SELECT COUNT(*) FROM work_items')[0]?.values[0]?.[0] || 0;
  const totalLinks = db.exec('SELECT COUNT(*) FROM work_item_links')[0]?.values[0]?.[0] || 0;
  
  console.log('\nDatabase Contents:');
  console.log('  Work Items:', totalItems);
  console.log('  Links:', totalLinks);
  
  // Test the orphan query that dashboard uses
  const orphans = db.exec(`
    SELECT COUNT(*) as count 
    FROM work_items 
    WHERE ado_id NOT IN (
      SELECT source_id FROM work_item_links 
      WHERE link_type LIKE '%Parent%' OR link_type LIKE '%Hierarchy-Reverse%'
    )
  `)[0]?.values[0]?.[0] || 0;
  
  const withChildren = db.exec(`
    SELECT COUNT(DISTINCT target_id) as count 
    FROM work_item_links 
    WHERE link_type LIKE '%Parent%' OR link_type LIKE '%Hierarchy-Reverse%'
  `)[0]?.values[0]?.[0] || 0;
  
  console.log('\nHierarchy Stats from DB:');
  console.log('  Orphans:', orphans);
  console.log('  Items with Children:', withChildren);
  
  db.close();
}
