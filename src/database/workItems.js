import { getDatabase, saveDatabase } from './db.js';

export function addWorkItem(workItem, skipSave = false) {
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
    rawData = {},
    needsTagging = null,
    // New enhanced fields
    acceptanceCriteria = '',
    reproSteps = '',
    systemInfo = '',
    priority = null,
    severity = '',
    storyPoints = null,
    businessValue = null,
    risk = '',
    foundInBuild = '',
    integrationBuild = '',
    resolvedBy = '',
    resolvedDate = '',
    closedBy = '',
    closedDate = '',
    activatedBy = '',
    activatedDate = '',
    stateReason = '',
    originalEstimate = null,
    remainingWork = null,
    completedWork = null,
    adoTags = ''
  } = workItem;

  // If needsTagging is not explicitly set, determine based on tags
  let shouldTag = needsTagging;
  if (shouldTag === null || shouldTag === undefined) {
    // Need tagging if no tags or empty tags
    shouldTag = !tags || tags.length === 0 || 
                (typeof tags === 'string' && (tags === '[]' || tags === ''));
  }

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO work_items (
      ado_id, title, description, work_item_type, state, 
      area_path, iteration_path, assigned_to, created_by,
      created_date, modified_date, tags, confidence_scores,
      project_name, raw_data, synced_at, needs_tagging,
      acceptance_criteria, repro_steps, system_info,
      priority, severity, story_points, business_value, risk,
      found_in_build, integration_build,
      resolved_by, resolved_date, closed_by, closed_date,
      activated_by, activated_date, state_reason,
      original_estimate, remaining_work, completed_work,
      ado_tags
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    new Date().toISOString(),
    shouldTag ? 1 : 0,
    acceptanceCriteria,
    reproSteps,
    systemInfo,
    priority,
    severity,
    storyPoints,
    businessValue,
    risk,
    foundInBuild,
    integrationBuild,
    resolvedBy,
    resolvedDate,
    closedBy,
    closedDate,
    activatedBy,
    activatedDate,
    stateReason,
    originalEstimate,
    remainingWork,
    completedWork,
    adoTags
  ]);

  stmt.free();
  
  // Only save if not batching
  if (!skipSave) {
    saveDatabase();
  }

  // Update tag usage
  updateTagUsage(tags, skipSave);

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
    parentId = null,
    hasParent = null,
    limit = 100,
    offset = 0
  } = options;

  let sql = 'SELECT * FROM work_items WHERE 1=1';
  const params = [];

  if (query) {
    sql += ' AND (title LIKE ? OR description LIKE ? OR acceptance_criteria LIKE ? OR repro_steps LIKE ?)';
    params.push(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
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

  // Parent/child relationship filters
  if (parentId !== null) {
    sql += ` AND ado_id IN (
      SELECT source_id FROM work_item_links 
      WHERE target_id = ? AND link_type LIKE '%Parent%'
    )`;
    params.push(parentId);
  }

  if (hasParent !== null) {
    if (hasParent === false) {
      // Find orphans - items with no parent link
      sql += ` AND ado_id NOT IN (
        SELECT source_id FROM work_item_links 
        WHERE link_type LIKE '%Parent%'
      )`;
    } else {
      // Find items that have a parent
      sql += ` AND ado_id IN (
        SELECT source_id FROM work_item_links 
        WHERE link_type LIKE '%Parent%'
      )`;
    }
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

export function addWorkItemLink(sourceId, targetId, linkType, skipSave = false) {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO work_item_links (source_id, target_id, link_type, created_at)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run([sourceId, targetId, linkType, new Date().toISOString()]);
  stmt.free();
  
  // Only save if not batching
  if (!skipSave) {
    saveDatabase();
  }
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

export function getWorkItemParent(adoId) {
  const db = getDatabase();
  const result = db.exec(`
    SELECT target_id FROM work_item_links 
    WHERE source_id = ? AND link_type LIKE '%Parent%'
    LIMIT 1
  `, [adoId]);
  
  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }

  return result[0].values[0][0];
}

export function getWorkItemChildren(adoId) {
  const db = getDatabase();
  const result = db.exec(`
    SELECT source_id FROM work_item_links 
    WHERE target_id = ? AND link_type LIKE '%Parent%'
  `, [adoId]);
  
  if (result.length === 0) {
    return [];
  }

  return result[0].values.map(row => row[0]);
}

function updateTagUsage(tags, skipSave = false) {
  const db = getDatabase();
  
  tags.forEach(tag => {
    db.run(`
      INSERT INTO tags (tag_name, usage_count) VALUES (?, 1)
      ON CONFLICT(tag_name) DO UPDATE SET usage_count = usage_count + 1
    `, [tag]);
  });
  
  // Only save if not batching
  if (!skipSave) {
    saveDatabase();
  }
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

  // Convert needs_tagging to boolean for consistency
  if (item.needs_tagging !== undefined) {
    item.needs_tagging = item.needs_tagging === 1 || item.needs_tagging === true;
  }

  return item;
}

export function getWorkItemsNeedingTags(limit = 50) {
  const db = getDatabase();
  const result = db.exec(`
    SELECT * FROM work_items 
    WHERE needs_tagging = 1 
    ORDER BY modified_date DESC 
    LIMIT ?
  `, [limit]);
  
  if (result.length === 0) {
    return [];
  }

  return result[0].values.map(row => parseWorkItem(result[0].columns, row));
}

export function markWorkItemAsTagged(adoId) {
  const db = getDatabase();
  db.run('UPDATE work_items SET needs_tagging = 0 WHERE ado_id = ?', [adoId]);
  saveDatabase();
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

  const pendingTagging = db.exec(`
    SELECT COUNT(*) as count 
    FROM work_items 
    WHERE needs_tagging = 1
  `)[0]?.values[0]?.[0] || 0;

  return {
    byType: byType.map(([type, count]) => ({ type, count })),
    byState: byState.map(([state, count]) => ({ state, count })),
    recentlyModified: recentlyModified ? 
      recentlyModified.values.map(row => parseWorkItem(recentlyModified.columns, row)) : [],
    pendingTagging
  };
}
