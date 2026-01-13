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
import { syncWithAzureDevOps, importHistoricalData, getSyncStatus, getSyncHistory } from '../sync/syncService.js';
import { generateTags } from '../utils/aiTagging.js';
import { getAllEnvVars } from '../utils/configManager.js';

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
    res.json({ success: true, data: stats });
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

// Backup database
app.post('/api/backup', (req, res) => {
  try {
    const backupPath = backupDatabase();
    res.json({ success: true, data: { backupPath } });
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
