import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  searchWorkItems,
  getAllWorkItems,
  getWorkItem,
  getWorkItemLinks,
  getAllTags,
  getTagSuggestions,
  getWorkItemStats
} from '../database/workItems.js';
import { getDatabaseStats, backupDatabase } from '../database/db.js';
import { syncWithAzureDevOps, importHistoricalData, getSyncStatus, getSyncHistory, getSyncProgress } from '../sync/syncService.js';
import { generateTags } from '../utils/aiTagging.js';
import { getAllEnvVars } from '../utils/configManager.js';
import { getProjects } from '../api/azureDevOps.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

// API Routes

// Search work items
app.get('/api/work-items/search', (req, res) => {
  try {
    const options = {
      query: req.query.q || '',
      tags: req.query.tags ? req.query.tags.split(',') : [],
      workItemType: req.query.type || '',
      state: req.query.state || '',
      areaPath: req.query.area || '',
      iterationPath: req.query.iteration || '',
      assignedTo: req.query.assignedTo || '',
      limit: parseInt(req.query.limit) || 100,
      offset: parseInt(req.query.offset) || 0
    };

    const results = searchWorkItems(options);
    res.json({ success: true, data: results, count: results.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all work items
app.get('/api/work-items', (req, res) => {
  try {
    const items = getAllWorkItems();
    res.json({ success: true, data: items, count: items.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single work item
app.get('/api/work-items/:id', (req, res) => {
  try {
    const item = getWorkItem(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Work item not found' });
    }
    
    const links = getWorkItemLinks(req.params.id);
    res.json({ success: true, data: { ...item, links } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all tags
app.get('/api/tags', (req, res) => {
  try {
    const tags = getAllTags();
    res.json({ success: true, data: tags });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get tag suggestions
app.get('/api/tags/suggest', (req, res) => {
  try {
    const query = req.query.q || '';
    const suggestions = getTagSuggestions(query);
    res.json({ success: true, data: suggestions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get work item statistics
app.get('/api/stats/work-items', (req, res) => {
  try {
    const stats = getWorkItemStats();
    const allItems = getAllWorkItems();
    
    res.json({ 
      success: true, 
      data: {
        ...stats,
        allItems: allItems
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get database statistics
app.get('/api/stats/database', (req, res) => {
  try {
    const stats = getDatabaseStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sync operations
app.post('/api/sync', async (req, res) => {
  try {
    const { projectName, fromDate, maxItems, autoTag } = req.body;
    
    if (!projectName) {
      return res.status(400).json({ success: false, error: 'Project name required' });
    }

    const result = await syncWithAzureDevOps(projectName, {
      fromDate,
      maxItems: maxItems || 1000,
      autoTag: autoTag !== false
    });

    res.json({ success: result.success, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Import historical data
app.post('/api/import', async (req, res) => {
  try {
    const { projectName, fromDate, batchSize } = req.body;
    
    if (!projectName) {
      return res.status(400).json({ success: false, error: 'Project name required' });
    }

    const result = await importHistoricalData(projectName, {
      fromDate,
      batchSize: batchSize || 500
    });

    res.json({ success: result.success, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get sync status
app.get('/api/sync/status', (req, res) => {
  try {
    const status = getSyncStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get sync history
app.get('/api/sync/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = getSyncHistory(limit);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get sync progress (for live updates)
app.get('/api/sync/progress', (req, res) => {
  try {
    const progress = getSyncProgress();
    res.json({ success: true, data: progress });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Backup database
app.post('/api/backup', (req, res) => {
  try {
    const backupPath = backupDatabase();
    res.json({ success: true, data: { backupPath } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Shrink database (VACUUM)
app.post('/api/database/shrink', (req, res) => {
  try {
    const db = getDatabaseStats();
    const sizeBefore = db.dbSizeMB;
    
    // Run VACUUM to shrink database
    const database = require('../database/db.js').getDatabase();
    database.run('VACUUM');
    
    const dbAfter = getDatabaseStats();
    const sizeAfter = dbAfter.dbSizeMB;
    const saved = sizeBefore - sizeAfter;
    
    res.json({ 
      success: true, 
      data: { 
        sizeBefore, 
        sizeAfter, 
        saved: saved.toFixed(2),
        message: `Database shrunk from ${sizeBefore}MB to ${sizeAfter}MB (saved ${saved.toFixed(2)}MB)`
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export to CSV
app.get('/api/export/csv', (req, res) => {
  try {
    const items = getAllWorkItems();
    
    // CSV header
    const headers = ['ID', 'Title', 'Type', 'State', 'Area Path', 'Iteration', 'Assigned To', 'Created Date', 'Modified Date', 'Tags'];
    const csv = [headers.join(',')];
    
    // CSV rows
    items.forEach(item => {
      const row = [
        item.ado_id,
        `"${(item.title || '').replace(/"/g, '""')}"`,
        item.work_item_type,
        item.state,
        `"${(item.area_path || '').replace(/"/g, '""')}"`,
        `"${(item.iteration_path || '').replace(/"/g, '""')}"`,
        item.assigned_to || '',
        item.created_date,
        item.modified_date,
        `"${(item.tags || []).join(', ')}"`
      ];
      csv.push(row.join(','));
    });
    
    const csvContent = csv.join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="ado-work-items-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export to Excel-compatible CSV (with UTF-8 BOM for Excel)
app.get('/api/export/excel', (req, res) => {
  try {
    const items = getAllWorkItems();
    
    // CSV header
    const headers = ['ID', 'Title', 'Type', 'State', 'Area Path', 'Iteration', 'Assigned To', 'Created Date', 'Modified Date', 'Tags'];
    const csv = [headers.join('\t')];
    
    // CSV rows (tab-separated for better Excel compatibility)
    items.forEach(item => {
      const row = [
        item.ado_id,
        (item.title || '').replace(/\t/g, ' '),
        item.work_item_type,
        item.state,
        (item.area_path || '').replace(/\t/g, ' '),
        (item.iteration_path || '').replace(/\t/g, ' '),
        item.assigned_to || '',
        item.created_date,
        item.modified_date,
        (item.tags || []).join(', ')
      ];
      csv.push(row.join('\t'));
    });
    
    // Add UTF-8 BOM for Excel
    const csvContent = '\uFEFF' + csv.join('\n');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ado-work-items-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate tags for testing
app.post('/api/tags/generate', (req, res) => {
  try {
    const { workItem } = req.body;
    const result = generateTags(workItem);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get current settings (read-only)
app.get('/api/settings', (req, res) => {
  try {
    const envVars = getAllEnvVars();
    
    res.json({ 
      success: true, 
      data: {
        env: envVars
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all available Azure DevOps projects
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await getProjects();
    res.json({ 
      success: true, 
      data: projects.map(p => ({ name: p.name, id: p.id, description: p.description }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ask Claude about tags and work items
app.post('/api/tags/ask-claude', async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({ success: false, error: 'Question required' });
    }

    // Get all work items and tags for context
    const allItems = getAllWorkItems();
    const allTags = getAllTags();
    
    // Prepare context for Claude
    const tagSummary = allTags.slice(0, 50).map(t => `${t.tagName} (used ${t.usageCount} times)`).join(', ');
    const itemTypes = {};
    const itemStates = {};
    
    allItems.forEach(item => {
      itemTypes[item.work_item_type] = (itemTypes[item.work_item_type] || 0) + 1;
      itemStates[item.state] = (itemStates[item.state] || 0) + 1;
    });
    
    const context = `
You are analyzing an Azure DevOps work item tracking system.

Database Statistics:
- Total work items: ${allItems.length}
- Total unique tags: ${allTags.length}

Work Item Types:
${Object.entries(itemTypes).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

Work Item States:
${Object.entries(itemStates).map(([state, count]) => `- ${state}: ${count}`).join('\n')}

Top Tags: ${tagSummary}

User Question: ${question}

Provide a helpful, concise answer based on the data above. If suggesting new tags, explain why they would be useful. If analyzing patterns, provide specific insights.`;

    // Call Claude API
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: 'dummy-key' });
    
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: context
      }]
    });

    const answer = response.content[0].text;
    res.json({ success: true, data: { answer } });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    data: { 
      status: 'ok',
      timestamp: new Date().toISOString()
    } 
  });
});

export function startDashboard(port = 3738) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      resolve(server);
    }).on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        startDashboard(port + 1).then(resolve).catch(reject);
      } else {
        reject(error);
      }
    });
  });
}

export default app;
