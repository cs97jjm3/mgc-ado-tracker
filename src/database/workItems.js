import { getDatabase, saveDatabase } from './db.js';

export function addWorkItem(workItem) {
  const db = getDatabase();
  
  const {
    adoId,
    title,
    description = '',
    workItemType,
    state,
    areaPath,
    iterationPath,
    assignedTo = '',
    createdBy = '',
    createdDate,
    modifiedDate,
    tags = [],
    confidenceScores = {},
    projectName = '',
    rawData = {}
  } = workItem;

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO work_items (
      ado_id, title, description, work_item_type, state, 
      area_path, iteration_path, assigned_to, created_by,
      created_date, modified_date, tags, confidence_scores,
      project_name, raw_data, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run([
    adoId,
    title,
    description,
    workItemType,
    state,
    areaPath,
    iterationPath,
    assignedTo,
    createdBy,
    createdDate,
    modifiedDate,
    JSON.stringify(tags),
    JSON.stringify(confidenceScores),
    projectName,
    JSON.stringify(rawData),
    new Date().toISOString()
  ]);

  stmt.free();
  saveDatabase();

  // Update tag usage
  updateTagUsage(tags);

  return adoId;
}

export function getWorkItem(adoId) {
  const db = getDatabase();
  const result = db.exec('SELECT * FROM work_items WHERE ado_id = ?', [adoId]);
  
  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }

  return parseWorkItem(result[0].columns, result[0].values[0]);
}

export function searchWorkItems(options = {}) {
  const db = getDatabase();
  const {
    query = '',
    tags = [],
    workItemType = '',
    state = '',
    areaPath = '',
    iterationPath = '',
    assignedTo = '',
    createdAfter = '',
    limit = 100,
    offset = 0
  } = options;

  let sql = 'SELECT * FROM work_items WHERE 1=1';
  const params = [];

  if (query) {
    sql += ' AND (title LIKE ? OR description LIKE ?)';
    params.push(`%${query}%`, `%${query}%`);
  }

  if (tags.length > 0) {
    const tagConditions = tags.map(() => 'tags LIKE ?').join(' OR ');
    sql += ` AND (${tagConditions})`;
    tags.forEach(tag => params.push(`%"${tag}"%`));
  }

  if (workItemType) {
    sql += ' AND work_item_type = ?';
    params.push(workItemType);
  }

  if (state) {
    sql += ' AND state = ?';
    params.push(state);
  }

  if (areaPath) {
    sql += ' AND area_path LIKE ?';
    params.push(`%${areaPath}%`);
  }

  if (iterationPath) {
    sql += ' AND iteration_path LIKE ?';
    params.push(`%${iterationPath}%`);
  }

  if (assignedTo) {
    sql += ' AND assigned_to LIKE ?';
    params.push(`%${assignedTo}%`);
  }

  if (createdAfter) {
    sql += ' AND created_date >= ?';
    params.push(createdAfter);
  }

  sql += ' ORDER BY modified_date DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const result = db.exec(sql, params);
  
  if (result.length === 0) {
    return [];
  }

  return result[0].values.map(row => parseWorkItem(result[0].columns, row));
}

export function getAllWorkItems() {
  const db = getDatabase();
  const result = db.exec('SELECT * FROM work_items ORDER BY modified_date DESC');
  
  if (result.length === 0) {
    return [];
  }

  return result[0].values.map(row => parseWorkItem(result[0].columns, row));
}

export function deleteWorkItem(adoId) {
  const db = getDatabase();
  db.run('DELETE FROM work_items WHERE ado_id = ?', [adoId]);
  db.run('DELETE FROM work_item_links WHERE source_id = ? OR target_id = ?', [adoId, adoId]);
  saveDatabase();
}

export function addWorkItemLink(sourceId, targetId, linkType) {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO work_item_links (source_id, target_id, link_type, created_at)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run([sourceId, targetId, linkType, new Date().toISOString()]);
  stmt.free();
  saveDatabase();
}

export function getWorkItemLinks(adoId) {
  const db = getDatabase();
  const result = db.exec(`
    SELECT * FROM work_item_links 
    WHERE source_id = ? OR target_id = ?
  `, [adoId, adoId]);
  
  if (result.length === 0) {
    return [];
  }

  return result[0].values.map(row => ({
    id: row[0],
    sourceId: row[1],
    targetId: row[2],
    linkType: row[3],
    createdAt: row[4]
  }));
}

function updateTagUsage(tags) {
  const db = getDatabase();
  
  tags.forEach(tag => {
    db.run(`
      INSERT INTO tags (tag_name, usage_count) VALUES (?, 1)
      ON CONFLICT(tag_name) DO UPDATE SET usage_count = usage_count + 1
    `, [tag]);
  });
  
  saveDatabase();
}

export function getAllTags() {
  const db = getDatabase();
  const result = db.exec('SELECT * FROM tags ORDER BY usage_count DESC');
  
  if (result.length === 0) {
    return [];
  }

  return result[0].values.map(row => ({
    id: row[0],
    tagName: row[1],
    usageCount: row[2],
    category: row[3]
  }));
}

export function getTagSuggestions(query) {
  const db = getDatabase();
  const result = db.exec(
    'SELECT tag_name FROM tags WHERE tag_name LIKE ? ORDER BY usage_count DESC LIMIT 10',
    [`%${query}%`]
  );
  
  if (result.length === 0) {
    return [];
  }

  return result[0].values.map(row => row[0]);
}

function parseWorkItem(columns, values) {
  const item = {};
  columns.forEach((col, i) => {
    item[col] = values[i];
  });

  // Parse JSON fields
  if (item.tags) {
    try {
      item.tags = JSON.parse(item.tags);
    } catch (e) {
      item.tags = [];
    }
  }

  if (item.confidence_scores) {
    try {
      item.confidence_scores = JSON.parse(item.confidence_scores);
    } catch (e) {
      item.confidence_scores = {};
    }
  }

  if (item.raw_data) {
    try {
      item.raw_data = JSON.parse(item.raw_data);
    } catch (e) {
      item.raw_data = {};
    }
  }

  return item;
}

export function getWorkItemStats() {
  const db = getDatabase();
  
  const byType = db.exec(`
    SELECT work_item_type, COUNT(*) as count 
    FROM work_items 
    GROUP BY work_item_type
  `)[0]?.values || [];

  const byState = db.exec(`
    SELECT state, COUNT(*) as count 
    FROM work_items 
    GROUP BY state
  `)[0]?.values || [];

  const recentlyModified = db.exec(`
    SELECT * FROM work_items 
    ORDER BY modified_date DESC 
    LIMIT 10
  `)[0];

  return {
    byType: byType.map(([type, count]) => ({ type, count })),
    byState: byState.map(([state, count]) => ({ state, count })),
    recentlyModified: recentlyModified ? 
      recentlyModified.values.map(row => parseWorkItem(recentlyModified.columns, row)) : []
  };
}
