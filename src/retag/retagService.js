import { getDatabase, saveDatabase } from '../database/db.js';
import { generateTags } from '../utils/aiTagging.js';

let retagInProgress = false;
let retagProgress = {
  totalItems: 0,
  processedItems: 0,
  successCount: 0,
  errorCount: 0,
  currentItem: null
};

/**
 * Estimate how many items would be re-tagged based on criteria
 */
export function estimateRetagCount(options = {}) {
  const { mode, confidenceThreshold, fromDate, toDate, projectName } = options;
  
  const db = getDatabase();
  let query = '';
  let params = [];
  
  switch(mode) {
    case 'all':
      query = 'SELECT COUNT(*) FROM work_items';
      break;
      
    case 'confidence':
      // Items with low confidence tags
      query = `
        SELECT COUNT(DISTINCT wi.id) 
        FROM work_items wi
        WHERE EXISTS (
          SELECT 1 FROM json_each(wi.confidence_scores) cs
          WHERE cs.value < ?
        )
      `;
      params = [confidenceThreshold || 0.8];
      break;
      
    case 'dateRange':
      query = `
        SELECT COUNT(*) FROM work_items 
        WHERE modified_date >= ? AND modified_date <= ?
      `;
      params = [fromDate, toDate];
      break;
      
    case 'project':
      query = 'SELECT COUNT(*) FROM work_items WHERE project_name = ?';
      params = [projectName];
      break;
      
    case 'untagged':
      query = `
        SELECT COUNT(*) FROM work_items 
        WHERE tags IS NULL OR tags = '[]' OR tags = ''
      `;
      break;
      
    default:
      throw new Error('Invalid re-tag mode');
  }
  
  const result = db.exec(query, params);
  const count = result[0]?.values[0]?.[0] || 0;
  
  return {
    estimatedCount: count,
    mode,
    criteria: options
  };
}

/**
 * Get items to be re-tagged based on criteria
 */
function getItemsForRetagging(options = {}) {
  const { mode, confidenceThreshold, fromDate, toDate, projectName } = options;
  
  const db = getDatabase();
  let query = '';
  let params = [];
  
  switch(mode) {
    case 'all':
      query = 'SELECT * FROM work_items ORDER BY id';
      break;
      
    case 'confidence':
      query = `
        SELECT wi.* 
        FROM work_items wi
        WHERE EXISTS (
          SELECT 1 FROM json_each(wi.confidence_scores) cs
          WHERE cs.value < ?
        )
        ORDER BY wi.id
      `;
      params = [confidenceThreshold || 0.8];
      break;
      
    case 'dateRange':
      query = `
        SELECT * FROM work_items 
        WHERE modified_date >= ? AND modified_date <= ?
        ORDER BY id
      `;
      params = [fromDate, toDate];
      break;
      
    case 'project':
      query = 'SELECT * FROM work_items WHERE project_name = ? ORDER BY id';
      params = [projectName];
      break;
      
    case 'untagged':
      query = `
        SELECT * FROM work_items 
        WHERE tags IS NULL OR tags = '[]' OR tags = ''
        ORDER BY id
      `;
      break;
      
    default:
      throw new Error('Invalid re-tag mode');
  }
  
  const result = db.exec(query, params);
  
  if (!result[0]) return [];
  
  const columns = result[0].columns;
  const rows = result[0].values;
  
  return rows.map(row => {
    const item = {};
    columns.forEach((col, idx) => {
      item[col] = row[idx];
    });
    
    // Parse JSON fields
    if (item.tags && typeof item.tags === 'string') {
      try {
        item.tags = JSON.parse(item.tags);
      } catch (e) {
        item.tags = [];
      }
    }
    
    if (item.confidence_scores && typeof item.confidence_scores === 'string') {
      try {
        item.confidence_scores = JSON.parse(item.confidence_scores);
      } catch (e) {
        item.confidence_scores = {};
      }
    }
    
    return item;
  });
}

/**
 * Backup current tags before re-tagging
 */
function backupTags(itemId, currentTags, currentConfidenceScores) {
  const db = getDatabase();
  
  db.run(`
    UPDATE work_items 
    SET tags_backup = ?,
        confidence_scores_backup = ?,
        backup_timestamp = ?
    WHERE id = ?
  `, [
    JSON.stringify(currentTags || []),
    JSON.stringify(currentConfidenceScores || {}),
    new Date().toISOString(),
    itemId
  ]);
}

/**
 * Separate hierarchy tags from AI-generated tags
 */
function separateHierarchyTags(tags = []) {
  const hierarchyTags = ['orphan', 'has-parent', 'top-level-feature', 'top-level-epic'];
  
  const hierarchy = tags.filter(tag => hierarchyTags.includes(tag));
  const aiTags = tags.filter(tag => !hierarchyTags.includes(tag));
  
  return { hierarchy, aiTags };
}

/**
 * Execute re-tagging operation
 */
export async function executeRetag(options = {}) {
  if (retagInProgress) {
    throw new Error('Re-tagging operation already in progress');
  }
  
  const {
    mode,
    confidenceThreshold,
    fromDate,
    toDate,
    projectName,
    batchSize = 50,
    preserveHierarchyTags = true
  } = options;
  
  retagInProgress = true;
  const startTime = Date.now();
  
  try {
    // Get items to re-tag
    const items = getItemsForRetagging({
      mode,
      confidenceThreshold,
      fromDate,
      toDate,
      projectName
    });
    
    retagProgress = {
      totalItems: items.length,
      processedItems: 0,
      successCount: 0,
      errorCount: 0,
      currentItem: null
    };
    
    const errors = [];
    const db = getDatabase();
    
    // Process in batches
    for (let i = 0; i < items.length; i += batchSize) {
      if (!retagInProgress) {
        throw new Error('Re-tagging cancelled by user');
      }
      
      const batch = items.slice(i, i + batchSize);
      
      for (const item of batch) {
        retagProgress.currentItem = `#${item.ado_id} - ${item.title}`;
        
        try {
          // Backup current tags
          backupTags(item.id, item.tags, item.confidence_scores);
          
          // Separate hierarchy tags if preserving
          const { hierarchy, aiTags } = separateHierarchyTags(item.tags);
          
          // Generate new AI tags
          const workItemForAI = {
            title: item.title,
            description: item.description,
            workItemType: item.work_item_type,
            areaPath: item.area_path,
            iterationPath: item.iteration_path,
            reproSteps: item.repro_steps,
            acceptanceCriteria: item.acceptance_criteria
          };
          
          const aiResult = await generateTags(workItemForAI);
          
          // Combine hierarchy tags (if preserving) with new AI tags
          const newTags = preserveHierarchyTags 
            ? [...hierarchy, ...aiResult.tags]
            : aiResult.tags;
          
          const newConfidenceScores = aiResult.confidence || {};
          
          // Update work item with new tags
          db.run(`
            UPDATE work_items 
            SET tags = ?,
                confidence_scores = ?,
                last_retagged_at = ?,
                needs_tagging = 0
            WHERE id = ?
          `, [
            JSON.stringify(newTags),
            JSON.stringify(newConfidenceScores),
            new Date().toISOString(),
            item.id
          ]);
          
          retagProgress.successCount++;
          
        } catch (error) {
          retagProgress.errorCount++;
          errors.push({
            workItemId: item.ado_id,
            error: error.message
          });
        }
        
        retagProgress.processedItems++;
      }
      
      // Save after each batch
      saveDatabase();
    }
    
    const durationMs = Date.now() - startTime;
    
    return {
      success: true,
      itemsProcessed: retagProgress.processedItems,
      successCount: retagProgress.successCount,
      errorCount: retagProgress.errorCount,
      durationMs,
      errors: errors.length > 0 ? errors : undefined
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      itemsProcessed: retagProgress.processedItems,
      successCount: retagProgress.successCount,
      errorCount: retagProgress.errorCount
    };
  } finally {
    retagInProgress = false;
    retagProgress = {
      totalItems: 0,
      processedItems: 0,
      successCount: 0,
      errorCount: 0,
      currentItem: null
    };
  }
}

/**
 * Get current re-tagging progress
 */
export function getRetagProgress() {
  return {
    inProgress: retagInProgress,
    ...retagProgress,
    percentage: retagProgress.totalItems > 0 
      ? Math.floor((retagProgress.processedItems / retagProgress.totalItems) * 100)
      : 0
  };
}

/**
 * Cancel ongoing re-tagging operation
 */
export function cancelRetag() {
  if (retagInProgress) {
    retagInProgress = false;
    return { success: true, message: 'Re-tagging will stop after current batch' };
  }
  return { success: false, message: 'No re-tagging operation in progress' };
}

/**
 * Get re-tagging history
 */
export function getRetagHistory(limit = 20) {
  const db = getDatabase();
  
  const result = db.exec(`
    SELECT 
      ado_id,
      title,
      work_item_type,
      tags_backup as old_tags,
      tags as new_tags,
      backup_timestamp,
      last_retagged_at
    FROM work_items
    WHERE last_retagged_at IS NOT NULL
    ORDER BY last_retagged_at DESC
    LIMIT ?
  `, [limit]);
  
  if (!result[0]) return [];
  
  const columns = result[0].columns;
  const rows = result[0].values;
  
  return rows.map(row => {
    const item = {};
    columns.forEach((col, idx) => {
      item[col] = row[idx];
    });
    
    // Parse JSON fields
    ['old_tags', 'new_tags'].forEach(field => {
      if (item[field] && typeof item[field] === 'string') {
        try {
          item[field] = JSON.parse(item[field]);
        } catch (e) {
          item[field] = [];
        }
      }
    });
    
    return item;
  });
}
