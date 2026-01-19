import { getWorkItemsFromADO, parseWorkItemFromADO } from '../api/azureDevOps.js';
import { addWorkItem, getAllWorkItems, addWorkItemLink, getWorkItemsNeedingTags } from '../database/workItems.js';
import { generateTagsWithAI } from '../utils/aiTagging.js';
import { getDatabase, saveDatabase } from '../database/db.js';

let syncInProgress = false;
let lastSyncResult = null;
let syncProgress = {
  current: 0,
  total: 0,
  currentItem: null,
  status: 'idle'
};

let taggingInProgress = false;
let taggingProgress = {
  current: 0,
  total: 0,
  status: 'idle'
};

export async function syncWithAzureDevOps(projectName, options = {}) {
  if (syncInProgress) {
    return lastSyncResult;
  }

  syncInProgress = true;
  const startTime = Date.now();
  
  const {
    fromDate = null,
    maxItems = 4000,
    batchSize = 50 // Process in batches
  } = options;

  // Work item types to exclude from sync
  const excludedTypes = [
    'Test Case',
    'Test Suite', 
    'Task',
    'Shared Parameter',
    'Test Plan',
    'Shared Steps'
  ];

  const result = {
    success: false,
    itemsAdded: 0,
    itemsUpdated: 0,
    itemsDeleted: 0,
    itemsSkipped: 0,
    errors: [],
    durationMs: 0
  };

  try {
    // Fetch work items from Azure DevOps
    syncProgress = { current: 0, total: 0, currentItem: 'Fetching work items from Azure DevOps...', status: 'fetching' };
    const adoWorkItems = await getWorkItemsFromADO(projectName, { fromDate, maxItems });
    
    syncProgress.total = adoWorkItems.length;
    syncProgress.status = 'processing';

    // Get existing items from local database
    const existingItems = getAllWorkItems();
    const existingMap = new Map(existingItems.map(item => [item.ado_id, item]));

    // Process in batches for better performance
    for (let batchStart = 0; batchStart < adoWorkItems.length; batchStart += batchSize) {
      const batch = adoWorkItems.slice(batchStart, Math.min(batchStart + batchSize, adoWorkItems.length));
      
      // Process batch items in parallel
      await Promise.all(batch.map(async (adoItem, batchIndex) => {
        const i = batchStart + batchIndex;
        syncProgress.current = i + 1;
        syncProgress.currentItem = `Processing #${adoItem.id}: ${adoItem.fields['System.Title']}`;
        
        try {
        const parsedItem = parseWorkItemFromADO(adoItem);
        
        // Skip excluded work item types
        if (excludedTypes.includes(parsedItem.workItemType)) {
          result.itemsSkipped++;
          return;
        }
        
        // Check if item exists
        const existing = existingMap.get(parsedItem.adoId);
        
        // Determine if item needs tagging
        // New items always need tagging, updated items need tagging if they don't have tags
        let needsTagging = true;
        if (existing) {
          // Check if existing item has tags
          let hasTags = false;
          if (existing.tags) {
            if (Array.isArray(existing.tags)) {
              hasTags = existing.tags.length > 0;
            } else if (typeof existing.tags === 'string') {
              try {
                const parsed = JSON.parse(existing.tags);
                hasTags = Array.isArray(parsed) && parsed.length > 0;
              } catch (e) {
                hasTags = existing.tags !== '[]' && existing.tags !== '';
              }
            }
          }
          
          if (hasTags) {
            // Item has tags - preserve them and don't mark for re-tagging
            parsedItem.tags = existing.tags;
            parsedItem.confidenceScores = existing.confidence_scores;
            needsTagging = false;
          }
        }

        // Track parent/child relationships
        let hasParent = false;
        let parentType = null;

        // Process links/relations
        if (adoItem.relations) {
          for (const relation of adoItem.relations) {
            if (relation.rel && relation.url) {
              const targetId = extractWorkItemId(relation.url);
              if (targetId) {
                addWorkItemLink(parsedItem.adoId, targetId, relation.rel, true); // Skip save during batch
                
                // Check if this is a parent link
                if (relation.rel && relation.rel.toLowerCase().includes('parent')) {
                  hasParent = true;
                  // Try to get parent type from relation attributes
                  if (relation.attributes && relation.attributes.name) {
                    parentType = relation.attributes.name;
                  }
                }
              }
            }
          }
        }

        // Add automatic hierarchy tags if item doesn't have tags yet
        if (needsTagging || !parsedItem.tags || parsedItem.tags.length === 0) {
          const hierarchyTags = [];
          
          if (!hasParent) {
            // Item has no parent - it's either orphaned or top-level
            if (parsedItem.workItemType === 'User Story' || parsedItem.workItemType === 'Task' || parsedItem.workItemType === 'Bug') {
              hierarchyTags.push('orphan');
            } else if (parsedItem.workItemType === 'Feature' || parsedItem.workItemType === 'Epic') {
              hierarchyTags.push(`top-level-${parsedItem.workItemType.toLowerCase()}`);
            }
          } else {
            // Item has a parent
            hierarchyTags.push('has-parent');
            if (parentType) {
              hierarchyTags.push(`child-of-${parentType.toLowerCase()}`);
            }
          }
          
          // Initialize or merge with existing tags
          if (!parsedItem.tags || parsedItem.tags.length === 0) {
            parsedItem.tags = hierarchyTags;
          } else if (Array.isArray(parsedItem.tags)) {
            parsedItem.tags = [...new Set([...parsedItem.tags, ...hierarchyTags])];
          }
          
          // If we added hierarchy tags, still mark for AI tagging to get more tags
          needsTagging = true;
        }
        
        // Flag item for tagging if needed (new items or items without tags)
        parsedItem.needsTagging = needsTagging;
        
        if (!existing) {
          addWorkItem(parsedItem, true); // Skip save during batch
          result.itemsAdded++;
        } else {
          // Check if modified
          if (existing.modified_date !== parsedItem.modifiedDate) {
            addWorkItem(parsedItem, true); // Skip save during batch
            result.itemsUpdated++;
          }
        }

        existingMap.delete(parsedItem.adoId);

      } catch (error) {
        console.error(`Error processing work item ${adoItem.id}:`, error.message);
        result.errors.push({
        adoId: adoItem.id,
        error: error.message
        });
        }
        }));
      
      // Save database once per batch (huge performance improvement)
      saveDatabase();
    }

    // Optionally handle deleted items (items in DB but not in ADO)
    // For now, we keep them as historical record
    result.itemsDeleted = 0; // We don't delete, just mark as not found in latest sync

    result.success = true;
    result.durationMs = Date.now() - startTime;

    // Log sync result to database
    logSyncResult(result);

  } catch (error) {
    result.success = false;
    result.errors.push({ error: error.message });
    result.durationMs = Date.now() - startTime;
    
    console.error('❌ Sync failed:', error.message);
    
    // Log failed sync
    logSyncResult(result);
  } finally {
    syncInProgress = false;
    lastSyncResult = result;
  }

  return result;
}

// Start background tagging of ALL items (not just pending)
export async function startBackgroundTagAll(options = {}) {
  if (taggingInProgress) {
    return { success: false, message: 'Background tagging already in progress' };
  }

  const {
    batchSize = 50,
    confidenceThreshold = 0.8,
    delayBetweenBatches = 5000
  } = options;

  taggingInProgress = true;

  // Run in background without blocking
  (async () => {
    try {
      const db = getDatabase();
      
      // Get total count
      const countResult = db.exec('SELECT COUNT(*) as count FROM work_items');
      const totalItems = countResult[0]?.values[0]?.[0] || 0;
      
      console.error(`Background tag all: Starting to tag ${totalItems} items...`);
      
      let offset = 0;
      let processedTotal = 0;

      while (taggingInProgress) {
        // Get next batch
        const batchResult = db.exec(`
          SELECT * FROM work_items 
          ORDER BY modified_date DESC
          LIMIT ? OFFSET ?
        `, [batchSize, offset]);

        if (!batchResult || batchResult.length === 0 || !batchResult[0].values || batchResult[0].values.length === 0) {
          console.error(`Background tag all: Complete! Tagged ${processedTotal} items total.`);
          taggingInProgress = false;
          break;
        }

        const columns = batchResult[0].columns;
        const itemsToTag = batchResult[0].values.map(row => {
          const item = {};
          columns.forEach((col, i) => {
            item[col] = row[i];
          });
          return item;
        });

        taggingProgress.total = totalItems;
        taggingProgress.current = processedTotal;
        taggingProgress.status = 'tagging';

        console.error(`Background tag all: Processing batch ${Math.floor(offset/batchSize) + 1}, items ${offset + 1}-${offset + itemsToTag.length}...`);

        // Tag this batch
        const result = await tagAllItems({
          batchSize: itemsToTag.length,
          confidenceThreshold
        });

        processedTotal += result.itemsTagged;
        console.error(`Background tag all: Tagged ${result.itemsTagged} items (${processedTotal}/${totalItems} total)`);

        offset += batchSize;

        // Wait before next batch
        if (taggingInProgress) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }
    } catch (error) {
      console.error('Background tag all error:', error.message);
      taggingInProgress = false;
    }

    taggingProgress.status = 'idle';
  })();

  return { 
    success: true, 
    message: 'Background tag all started - will tag ALL items in database',
    note: 'Use getTaggingStatus() to check progress.'
  };
}

export async function importHistoricalData(projectName, options = {}) {
  
  const {
    fromDate = null,
    toDate = null,
    batchSize = 500
  } = options;

  // Build date filter
  let dateFilter = fromDate ? new Date(fromDate).toISOString() : null;
  
  // Sync in batches (no auto-tagging - items will be flagged for tagging separately)
  const result = await syncWithAzureDevOps(projectName, {
    fromDate: dateFilter,
    maxItems: batchSize
  });

  return result;
}

function extractWorkItemId(url) {
  // Extract work item ID from ADO URL
  const match = url.match(/workItems\/(\d+)/);
  return match ? match[1] : null;
}

function logSyncResult(result) {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    INSERT INTO sync_log (
      sync_date, items_added, items_updated, items_deleted,
      status, error_message, duration_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run([
    new Date().toISOString(),
    result.itemsAdded,
    result.itemsUpdated,
    result.itemsDeleted,
    result.success ? 'success' : 'failed',
    result.errors.length > 0 ? JSON.stringify(result.errors) : null,
    result.durationMs
  ]);

  stmt.free();
  saveDatabase();
}

export function getSyncStatus() {
  const db = getDatabase();
  
  const lastSync = db.exec(`
    SELECT * FROM sync_log 
    ORDER BY sync_date DESC 
    LIMIT 1
  `)[0];

  if (!lastSync || lastSync.values.length === 0) {
    return {
      lastSync: null,
      status: 'never',
      inProgress: syncInProgress
    };
  }

  const [id, syncDate, itemsAdded, itemsUpdated, itemsDeleted, status, errorMessage, durationMs] = lastSync.values[0];

  return {
    lastSync: {
      date: syncDate,
      itemsAdded,
      itemsUpdated,
      itemsDeleted,
      status,
      errors: errorMessage ? JSON.parse(errorMessage) : [],
      durationMs
    },
    status,
    inProgress: syncInProgress
  };
}

export function getSyncHistory(limit = 10) {
  const db = getDatabase();
  
  const result = db.exec(`
    SELECT * FROM sync_log 
    ORDER BY sync_date DESC 
    LIMIT ?
  `, [limit]);

  if (result.length === 0) {
    return [];
  }

  return result[0].values.map(row => ({
    id: row[0],
    syncDate: row[1],
    itemsAdded: row[2],
    itemsUpdated: row[3],
    itemsDeleted: row[4],
    status: row[5],
    errors: row[6] ? JSON.parse(row[6]) : [],
    durationMs: row[7]
  }));
}

export function isSyncInProgress() {
  return syncInProgress;
}

export function getLastSyncResult() {
  return lastSyncResult;
}

export function getSyncProgress() {
  return {
    ...syncProgress,
    inProgress: syncInProgress,
    percentage: syncProgress.total > 0 ? Math.round((syncProgress.current / syncProgress.total) * 100) : 0
  };
}

// Clean up excluded work item types from database
export function cleanupExcludedWorkItemTypes() {
  const db = getDatabase();
  
  const excludedTypes = [
    'Test Case',
    'Test Suite',
    'Task',
    'Shared Parameter',
    'Test Plan',
    'Shared Steps'
  ];
  
  const placeholders = excludedTypes.map(() => '?').join(',');
  
  const result = db.exec(`
    SELECT COUNT(*) as count FROM work_items 
    WHERE work_item_type IN (${placeholders})
  `, excludedTypes);
  
  const count = result[0]?.values[0]?.[0] || 0;
  
  if (count > 0) {
    // Delete the excluded work items
    db.exec(`
      DELETE FROM work_items 
      WHERE work_item_type IN (${placeholders})
    `, excludedTypes);
    
    // Clean up orphaned links
    db.exec(`
      DELETE FROM work_item_links
      WHERE source_id NOT IN (SELECT ado_id FROM work_items)
         OR target_id NOT IN (SELECT ado_id FROM work_items)
    `);
    
    saveDatabase();
    
    return {
      success: true,
      itemsDeleted: count,
      message: `Deleted ${count} excluded work items (${excludedTypes.join(', ')})`
    };
  }
  
  return {
    success: true,
    itemsDeleted: 0,
    message: 'No excluded work items found'
  };
}

// Tag pending work items using AI
// This function processes items that are flagged for tagging and generates tags using AI
export async function tagPendingWorkItems(options = {}) {
  const {
    batchSize = 10,
    confidenceThreshold = 0.8,
    concurrency = 5  // Process 5 items at a time in parallel
  } = options;

  const result = {
    success: false,
    itemsTagged: 0,
    itemsFailed: 0,
    errors: [],
    durationMs: 0
  };

  const startTime = Date.now();

  try {
    // Get items that need tagging
    const itemsToTag = getWorkItemsNeedingTags(batchSize);

    if (itemsToTag.length === 0) {
      result.success = true;
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Process items in batches with controlled concurrency
    for (let i = 0; i < itemsToTag.length; i += concurrency) {
      const batch = itemsToTag.slice(i, Math.min(i + concurrency, itemsToTag.length));
      
      // Process this batch in parallel
      const taggingPromises = batch.map(async (item) => {
        try {
          // Convert database item to work item format for tagging
          const workItem = {
            adoId: item.ado_id,
            title: item.title,
            description: item.description || '',
            acceptanceCriteria: item.acceptance_criteria || '',
            reproSteps: item.repro_steps || '',
            workItemType: item.work_item_type,
            state: item.state,
            areaPath: item.area_path,
            iterationPath: item.iteration_path
          };

          // Generate tags using AI
          const { tags, confidenceScores } = await generateTagsWithAI(workItem, {
            confidenceThreshold,
            useAI: true
          });

          // Merge with existing hierarchy tags
          let existingTags = [];
          if (item.tags) {
            try {
              existingTags = typeof item.tags === 'string' ? JSON.parse(item.tags) : item.tags;
            } catch (e) {
              existingTags = [];
            }
          }
          
          // Combine and deduplicate tags
          const combinedTags = [...new Set([...existingTags, ...tags])];

          // Update work item with merged tags
          addWorkItem({
            adoId: item.ado_id,
            title: item.title,
            description: item.description || '',
            workItemType: item.work_item_type,
            state: item.state,
            areaPath: item.area_path,
            iterationPath: item.iteration_path,
            assignedTo: item.assigned_to || '',
            createdBy: item.created_by || '',
            createdDate: item.created_date,
            modifiedDate: item.modified_date,
            tags: combinedTags,
            confidenceScores,
            projectName: item.project_name || '',
            rawData: item.raw_data || {},
            needsTagging: false, // Mark as tagged
            
            // Include all enhanced fields
            acceptanceCriteria: item.acceptance_criteria || '',
            reproSteps: item.repro_steps || '',
            systemInfo: item.system_info || '',
            priority: item.priority,
            severity: item.severity || '',
            storyPoints: item.story_points,
            businessValue: item.business_value,
            risk: item.risk || '',
            foundInBuild: item.found_in_build || '',
            integrationBuild: item.integration_build || '',
            resolvedBy: item.resolved_by || '',
            resolvedDate: item.resolved_date || '',
            closedBy: item.closed_by || '',
            closedDate: item.closed_date || '',
            activatedBy: item.activated_by || '',
            activatedDate: item.activated_date || '',
            stateReason: item.state_reason || '',
            originalEstimate: item.original_estimate,
            remainingWork: item.remaining_work,
            completedWork: item.completed_work,
            adoTags: item.ado_tags || ''
          });

          result.itemsTagged++;
        } catch (error) {
          console.error(`Error tagging work item ${item.ado_id}:`, error.message);
          result.itemsFailed++;
          result.errors.push({
            adoId: item.ado_id,
            error: error.message
          });
        }
      });

      // Wait for this batch to complete before starting next batch
      await Promise.all(taggingPromises);
      
      // Save after each batch
      saveDatabase();
    }

    result.success = true;
    result.durationMs = Date.now() - startTime;

  } catch (error) {
    result.success = false;
    result.errors.push({ error: error.message });
    result.durationMs = Date.now() - startTime;
    console.error('Tagging failed:', error.message);
  }

  return result;
}

// Start background AI tagging that runs continuously
export async function startBackgroundTagging(options = {}) {
  if (taggingInProgress) {
    return { success: false, message: 'Background tagging already in progress' };
  }

  const {
    batchSize = 50,
    confidenceThreshold = 0.8,
    delayBetweenBatches = 5000 // 5 seconds between batches
  } = options;

  taggingInProgress = true;

  // Run in background without blocking
  (async () => {
    try {
      while (taggingInProgress) {
        // Get pending items
        const itemsToTag = getWorkItemsNeedingTags(batchSize);
        
        if (itemsToTag.length === 0) {
          console.error('Background tagging: No more items to tag, stopping');
          taggingInProgress = false;
          break;
        }

        taggingProgress.total = itemsToTag.length;
        taggingProgress.current = 0;
        taggingProgress.status = 'tagging';

        console.error(`Background tagging: Processing ${itemsToTag.length} items...`);

        // Tag this batch
        const result = await tagPendingWorkItems({
          batchSize: itemsToTag.length,
          confidenceThreshold
        });

        console.error(`Background tagging: Tagged ${result.itemsTagged} items, ${result.itemsFailed} failed`);

        // Check if we should continue
        const remaining = getWorkItemsNeedingTags(1);
        if (remaining.length === 0) {
          console.error('Background tagging: Complete!');
          taggingInProgress = false;
          break;
        }

        // Wait before next batch
        if (taggingInProgress) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }
    } catch (error) {
      console.error('Background tagging error:', error.message);
      taggingInProgress = false;
    }

    taggingProgress.status = 'idle';
  })();

  return { 
    success: true, 
    message: 'Background tagging started',
    note: 'Tagging will continue in background. Use getTaggingStatus() to check progress.'
  };
}

export function stopBackgroundTagging() {
  if (!taggingInProgress) {
    return { success: false, message: 'No background tagging in progress' };
  }

  taggingInProgress = false;
  return { success: true, message: 'Background tagging will stop after current batch' };
}

export function getTaggingStatus() {
  const db = getDatabase();
  const result = db.exec(`
    SELECT COUNT(*) as count 
    FROM work_items 
    WHERE needs_tagging = 1
  `);
  
  const pendingCount = result[0]?.values[0]?.[0] || 0;

  return {
    inProgress: taggingInProgress,
    progress: taggingProgress,
    pendingCount
  };
}

// Force tag ALL items (ignore needs_tagging flag)
export async function tagAllItems(options = {}) {
  const {
    batchSize = 50,
    confidenceThreshold = 0.8,
    concurrency = 5
  } = options;

  const result = {
    success: false,
    itemsTagged: 0,
    itemsFailed: 0,
    errors: [],
    durationMs: 0
  };

  const startTime = Date.now();

  try {
    // Get ALL items regardless of needs_tagging flag
    const db = getDatabase();
    const allItemsResult = db.exec(`
      SELECT * FROM work_items 
      ORDER BY modified_date DESC
      LIMIT ?
    `, [batchSize]);

    if (!allItemsResult || allItemsResult.length === 0 || !allItemsResult[0].values) {
      result.success = true;
      result.durationMs = Date.now() - startTime;
      return result;
    }

    const columns = allItemsResult[0].columns;
    const itemsToTag = allItemsResult[0].values.map(row => {
      const item = {};
      columns.forEach((col, i) => {
        item[col] = row[i];
      });
      return item;
    });

    if (itemsToTag.length === 0) {
      result.success = true;
      result.durationMs = Date.now() - startTime;
      return result;
    }

    console.error(`Force tagging ${itemsToTag.length} items...`);

    // Process items in batches with controlled concurrency
    for (let i = 0; i < itemsToTag.length; i += concurrency) {
      const batch = itemsToTag.slice(i, Math.min(i + concurrency, itemsToTag.length));
      
      const taggingPromises = batch.map(async (item) => {
        try {
          const workItem = {
            adoId: item.ado_id,
            title: item.title,
            description: item.description || '',
            acceptanceCriteria: item.acceptance_criteria || '',
            reproSteps: item.repro_steps || '',
            workItemType: item.work_item_type,
            state: item.state,
            areaPath: item.area_path,
            iterationPath: item.iteration_path
          };

          const { tags, confidenceScores } = await generateTagsWithAI(workItem, {
            confidenceThreshold,
            useAI: true
          });

          // Merge with existing tags
          let existingTags = [];
          if (item.tags) {
            try {
              existingTags = typeof item.tags === 'string' ? JSON.parse(item.tags) : item.tags;
            } catch (e) {
              existingTags = [];
            }
          }
          
          const combinedTags = [...new Set([...existingTags, ...tags])];

          addWorkItem({
            adoId: item.ado_id,
            title: item.title,
            description: item.description || '',
            workItemType: item.work_item_type,
            state: item.state,
            areaPath: item.area_path,
            iterationPath: item.iteration_path,
            assignedTo: item.assigned_to || '',
            createdBy: item.created_by || '',
            createdDate: item.created_date,
            modifiedDate: item.modified_date,
            tags: combinedTags,
            confidenceScores,
            projectName: item.project_name || '',
            rawData: item.raw_data || {},
            needsTagging: false,
            acceptanceCriteria: item.acceptance_criteria || '',
            reproSteps: item.repro_steps || '',
            systemInfo: item.system_info || '',
            priority: item.priority,
            severity: item.severity || '',
            storyPoints: item.story_points,
            businessValue: item.business_value,
            risk: item.risk || '',
            foundInBuild: item.found_in_build || '',
            integrationBuild: item.integration_build || '',
            resolvedBy: item.resolved_by || '',
            resolvedDate: item.resolved_date || '',
            closedBy: item.closed_by || '',
            closedDate: item.closed_date || '',
            activatedBy: item.activated_by || '',
            activatedDate: item.activated_date || '',
            stateReason: item.state_reason || '',
            originalEstimate: item.original_estimate,
            remainingWork: item.remaining_work,
            completedWork: item.completed_work,
            adoTags: item.ado_tags || ''
          });

          result.itemsTagged++;
        } catch (error) {
          console.error(`Error tagging ${item.ado_id}:`, error.message);
          result.itemsFailed++;
          result.errors.push({ adoId: item.ado_id, error: error.message });
        }
      });

      await Promise.all(taggingPromises);
      saveDatabase();
    }

    result.success = true;
    result.durationMs = Date.now() - startTime;

  } catch (error) {
    result.success = false;
    result.errors.push({ error: error.message });
    result.durationMs = Date.now() - startTime;
  }

  return result;
}
