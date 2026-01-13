import { getWorkItemsFromADO, parseWorkItemFromADO } from '../api/azureDevOps.js';
import { addWorkItem, getAllWorkItems, addWorkItemLink } from '../database/workItems.js';
import { generateTags } from '../utils/aiTagging.js';
import { getDatabase, saveDatabase } from '../database/db.js';

let syncInProgress = false;
let lastSyncResult = null;

export async function syncWithAzureDevOps(projectName, options = {}) {
  if (syncInProgress) {
    return lastSyncResult;
  }

  syncInProgress = true;
  const startTime = Date.now();
  
  const {
    fromDate = null,
    maxItems = 1000,
    autoTag = true,
    confidenceThreshold = 0.5
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
    const adoWorkItems = await getWorkItemsFromADO(projectName, { fromDate, maxItems });

    // Get existing items from local database
    const existingItems = getAllWorkItems();
    const existingMap = new Map(existingItems.map(item => [item.ado_id, item]));

    // Process each work item
    for (const adoItem of adoWorkItems) {
      try {
        const parsedItem = parseWorkItemFromADO(adoItem);
        
        // Generate AI tags if enabled
        if (autoTag) {
          const { tags, confidenceScores } = generateTags(parsedItem, { confidenceThreshold });
          parsedItem.tags = tags;
          parsedItem.confidenceScores = confidenceScores;
        }

        // Check if item exists
        const existing = existingMap.get(parsedItem.adoId);
        
        if (!existing) {
          addWorkItem(parsedItem);
          result.itemsAdded++;
        } else {
          // Check if modified
          if (existing.modified_date !== parsedItem.modifiedDate) {
            addWorkItem(parsedItem);
            result.itemsUpdated++;
          }
        }

        // Process links/relations
        if (adoItem.relations) {
          for (const relation of adoItem.relations) {
            if (relation.rel && relation.url) {
              const targetId = extractWorkItemId(relation.url);
              if (targetId) {
                addWorkItemLink(parsedItem.adoId, targetId, relation.rel);
              }
            }
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
  
  // Sync in batches
  const result = await syncWithAzureDevOps(projectName, {
    fromDate: dateFilter,
    maxItems: batchSize,
    autoTag: true,
    confidenceThreshold: 0.5
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
