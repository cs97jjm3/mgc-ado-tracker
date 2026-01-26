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
      WHERE target_id = ? AND (link_type LIKE '%Parent%' OR link_type LIKE '%Hierarchy-Reverse%')
    )`;
    params.push(parentId);
  }

  if (hasParent !== null) {
    if (hasParent === false) {
      // Find orphans - items with no parent link
      sql += ` AND ado_id NOT IN (
        SELECT source_id FROM work_item_links 
        WHERE link_type LIKE '%Parent%' OR link_type LIKE '%Hierarchy-Reverse%'
      )`;
    } else {
      // Find items that have a parent
      sql += ` AND ado_id IN (
        SELECT source_id FROM work_item_links 
        WHERE link_type LIKE '%Parent%' OR link_type LIKE '%Hierarchy-Reverse%'
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
    WHERE source_id = ? AND (link_type LIKE '%Parent%' OR link_type LIKE '%Hierarchy-Reverse%')
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
    SELECT DISTINCT source_id FROM work_item_links 
    WHERE target_id = ? AND (link_type LIKE '%Parent%' OR link_type LIKE '%Hierarchy-Reverse%')
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

  // HIERARCHY & RELATIONSHIP STATS (PROJECT-AWARE)
  const epicCount = db.exec(`
    SELECT COUNT(*) as count 
    FROM work_items 
    WHERE work_item_type = 'Epic'
  `)[0]?.values[0]?.[0] || 0;

  const featureCount = db.exec(`
    SELECT COUNT(*) as count 
    FROM work_items 
    WHERE work_item_type = 'Feature'
  `)[0]?.values[0]?.[0] || 0;

  // PROJECT-AWARE ORPHAN COUNT: Items without parents WITHIN their own project
  const projects = db.exec(`
    SELECT DISTINCT project_name FROM work_items WHERE project_name IS NOT NULL
  `)[0]?.values || [];
  
  let orphanCount = 0;
  projects.forEach(([project]) => {
    const projectOrphans = db.exec(`
      SELECT COUNT(*) FROM work_items 
      WHERE project_name = '${project.replace(/'/g, "''")}'
      AND ado_id NOT IN (
        SELECT wi.ado_id FROM work_items wi
        INNER JOIN work_item_links wil ON wi.ado_id = wil.source_id
        WHERE wi.project_name = '${project.replace(/'/g, "''")}'
        AND (wil.link_type LIKE '%Parent%' OR wil.link_type LIKE '%Hierarchy-Reverse%')
      )
    `)[0]?.values[0]?.[0] || 0;
    orphanCount += projectOrphans;
  });

  const itemsWithChildren = db.exec(`
    SELECT COUNT(DISTINCT target_id) as count 
    FROM work_item_links 
    WHERE link_type LIKE '%Parent%' OR link_type LIKE '%Hierarchy-Reverse%'
  `)[0]?.values[0]?.[0] || 0;

  const avgChildrenPerParent = db.exec(`
    SELECT AVG(child_count) as avg
    FROM (
      SELECT target_id, COUNT(*) as child_count
      FROM work_item_links
      WHERE link_type LIKE '%Parent%' OR link_type LIKE '%Hierarchy-Reverse%'
      GROUP BY target_id
    )
  `)[0]?.values[0]?.[0] || 0;

  const maxDepth = db.exec(`
    WITH RECURSIVE hierarchy(id, depth) AS (
      SELECT ado_id, 0
      FROM work_items
      WHERE ado_id NOT IN (
        SELECT source_id FROM work_item_links 
        WHERE link_type LIKE '%Parent%' OR link_type LIKE '%Hierarchy-Reverse%'
      )
      UNION ALL
      SELECT l.source_id, h.depth + 1
      FROM hierarchy h
      JOIN work_item_links l ON h.id = l.target_id
      WHERE l.link_type LIKE '%Parent%' OR l.link_type LIKE '%Hierarchy-Reverse%'
    )
    SELECT MAX(depth) FROM hierarchy
  `)[0]?.values[0]?.[0] || 0;

  // WORK ITEM HEALTH
  const totalCount = db.exec('SELECT COUNT(*) FROM work_items')[0]?.values[0]?.[0] || 0;
  const taggedCount = totalCount - pendingTagging;
  
  const avgTagsPerItem = db.exec(`
    SELECT AVG(
      LENGTH(tags) - LENGTH(REPLACE(tags, ',', '')) + 1
    ) as avg
    FROM work_items
    WHERE tags != '[]' AND tags IS NOT NULL
  `)[0]?.values[0]?.[0] || 0;

  const itemsWithoutDescription = db.exec(`
    SELECT COUNT(*) as count 
    FROM work_items 
    WHERE description IS NULL OR description = '' OR description = '""'
  `)[0]?.values[0]?.[0] || 0;

  const staleItems30 = db.exec(`
    SELECT COUNT(*) as count 
    FROM work_items 
    WHERE modified_date < datetime('now', '-30 days')
    AND state NOT IN ('Closed', 'Resolved')
  `)[0]?.values[0]?.[0] || 0;

  const staleItems60 = db.exec(`
    SELECT COUNT(*) as count 
    FROM work_items 
    WHERE modified_date < datetime('now', '-60 days')
    AND state NOT IN ('Closed', 'Resolved')
  `)[0]?.values[0]?.[0] || 0;

  const staleItems90 = db.exec(`
    SELECT COUNT(*) as count 
    FROM work_items 
    WHERE modified_date < datetime('now', '-90 days')
    AND state NOT IN ('Closed', 'Resolved')
  `)[0]?.values[0]?.[0] || 0;

  // COMPLETION RATE
  const completedCount = db.exec(`
    SELECT COUNT(*) as count 
    FROM work_items 
    WHERE state IN ('Resolved', 'Closed')
  `)[0]?.values[0]?.[0] || 0;
  
  const completionRate = totalCount > 0 ? ((completedCount / totalCount) * 100).toFixed(1) : 0;

  // TIME-BASED STATS
  const itemsThisWeek = db.exec(`
    SELECT COUNT(*) as count 
    FROM work_items 
    WHERE created_date >= datetime('now', '-7 days')
  `)[0]?.values[0]?.[0] || 0;

  const itemsThisMonth = db.exec(`
    SELECT COUNT(*) as count 
    FROM work_items 
    WHERE created_date >= datetime('now', '-30 days')
  `)[0]?.values[0]?.[0] || 0;

  const closedThisWeek = db.exec(`
    SELECT COUNT(*) as count 
    FROM work_items 
    WHERE closed_date >= datetime('now', '-7 days')
  `)[0]?.values[0]?.[0] || 0;

  const closedThisMonth = db.exec(`
    SELECT COUNT(*) as count 
    FROM work_items 
    WHERE closed_date >= datetime('now', '-30 days')
  `)[0]?.values[0]?.[0] || 0;

  const avgAgeOpenItems = db.exec(`
    SELECT AVG(
      julianday('now') - julianday(created_date)
    ) as avg
    FROM work_items
    WHERE state NOT IN ('Closed', 'Resolved')
  `)[0]?.values[0]?.[0] || 0;

  const oldestOpenItem = db.exec(`
    SELECT ado_id, title, 
    julianday('now') - julianday(created_date) as age_days
    FROM work_items
    WHERE state NOT IN ('Closed', 'Resolved')
    ORDER BY created_date ASC
    LIMIT 1
  `)[0];

  return {
    byType: byType.map(([type, count]) => ({ type, count })),
    byState: byState.map(([state, count]) => ({ state, count })),
    recentlyModified: recentlyModified ? 
      recentlyModified.values.map(row => parseWorkItem(recentlyModified.columns, row)) : [],
    pendingTagging,
    
    // Hierarchy stats
    epicCount,
    featureCount,
    orphanCount,
    itemsWithChildren,
    avgChildrenPerParent: Math.round(avgChildrenPerParent * 10) / 10,
    maxHierarchyDepth: maxDepth,
    
    // Health stats
    totalCount,
    taggedCount,
    taggingProgress: totalCount > 0 ? ((taggedCount / totalCount) * 100).toFixed(1) : 0,
    avgTagsPerItem: Math.round(avgTagsPerItem * 10) / 10,
    itemsWithoutDescription,
    staleItems30Days: staleItems30,
    staleItems60Days: staleItems60,
    staleItems90Days: staleItems90,
    completionRate,
    
    // Time-based stats
    itemsCreatedThisWeek: itemsThisWeek,
    itemsCreatedThisMonth: itemsThisMonth,
    itemsClosedThisWeek: closedThisWeek,
    itemsClosedThisMonth: closedThisMonth,
    avgAgeOpenItems: Math.round(avgAgeOpenItems),
    oldestOpenItem: oldestOpenItem ? {
      id: oldestOpenItem.values[0][0],
      title: oldestOpenItem.values[0][1],
      ageDays: Math.round(oldestOpenItem.values[0][2])
    } : null
  };
}
