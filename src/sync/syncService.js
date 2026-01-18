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

  const result = {
    success: false,
    itemsAdded: 0,
    itemsUpdated: 0,
    itemsDeleted: 0,
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

// Tag pending work items using AI
// This function processes items that are flagged for tagging and generates tags using AI
export async function tagPendingWorkItems(options = {}) {
  const {
    batchSize = 10,
    confidenceThreshold = 0.8
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

    // Process items in parallel (but limit concurrency to avoid overwhelming AI)
    const taggingPromises = itemsToTag.map(async (item) => {
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

        // Update work item with tags
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
          tags,
          confidenceScores,
          projectName: item.project_name || '',
          rawData: item.raw_data || {},
          needsTagging: false // Mark as tagged
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

    await Promise.all(taggingPromises);

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
