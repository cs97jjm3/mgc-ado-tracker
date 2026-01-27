import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import {
  initializeUsersTable,
  authenticateUser,
  requireAuth,
  requireAdmin,
  getUserById,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  changePassword
} from '../auth/auth.js';
import {
  searchWorkItems,
  getAllWorkItems,
  getWorkItem,
  getWorkItemLinks,
  getAllTags,
  getTagSuggestions,
  getWorkItemStats
} from '../database/workItems.js';
import { getDatabaseStats, backupDatabase, getDatabase, saveDatabase, vacuumDatabase, reloadDatabase } from '../database/db.js';
import { syncWithAzureDevOps, importHistoricalData, getSyncStatus, getSyncHistory, getSyncProgress, tagPendingWorkItems } from '../sync/syncService.js';
import { estimateRetagCount, executeRetag, getRetagProgress, cancelRetag, getRetagHistory } from '../retag/retagService.js';
import { generateTags } from '../utils/aiTagging.js';
import { getAllEnvVars } from '../utils/configManager.js';
import { getProjects } from '../api/azureDevOps.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Session configuration
const SESSION_SECRET = process.env.SESSION_SECRET || 'mgc-ado-tracker-' + Math.random().toString(36);
const SESSION_MAX_AGE = parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000; // 24 hours default

app.use(express.json());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    httpOnly: true,
    maxAge: SESSION_MAX_AGE
  }
}));

// Note: Users table will be initialized when startDashboard() is called

// Serve login page for unauthenticated users
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/login.html'));
});

// Serve static files only if authenticated (except login.html)
app.use((req, res, next) => {
  // Allow access to login page and auth endpoints
  if (req.path === '/login.html' || req.path.startsWith('/api/auth/')) {
    return next();
  }
  
  // Require authentication for all other routes
  if (!req.session || !req.session.userId) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return res.redirect('/login.html');
  }
  
  next();
});

app.use(express.static(path.join(__dirname, '../../public')));

// ============================================
// AUTHENTICATION API ENDPOINTS
// ============================================

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }
    
    const user = await authenticateUser(email, password);
    
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }
    
    // Set session
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.userRole = user.role;
    
    // Extend session if remember me
    if (rememberMe) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    }
    
    res.json({ 
      success: true, 
      data: { 
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role
        }
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Logout failed' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// Get current user
app.get('/api/auth/me', requireAuth, (req, res) => {
  try {
    const user = getUserById(req.session.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: { user } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// USER MANAGEMENT API (ADMIN ONLY)
// ============================================

// List all users
app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
  try {
    const users = listUsers();
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create user
app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  try {
    const { email, password, role, displayName } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }
    
    const user = createUser(email, password, role || 'user', displayName);
    res.json({ success: true, data: { user } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update user
app.put('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    const { email, displayName, role, isActive } = req.body;
    const updates = {};
    
    if (email !== undefined) updates.email = email;
    if (displayName !== undefined) updates.display_name = displayName;
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.is_active = isActive ? 1 : 0;
    
    const success = updateUser(parseInt(req.params.id), updates);
    
    if (!success) {
      return res.status(400).json({ success: false, error: 'Update failed' });
    }
    
    res.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Change password
app.post('/api/users/:id/password', requireAuth, (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { newPassword } = req.body;
    
    // Users can only change their own password unless admin
    const currentUser = getUserById(req.session.userId);
    if (userId !== req.session.userId && currentUser.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }
    
    changePassword(userId, newPassword);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete user
app.delete('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Prevent deleting yourself
    if (userId === req.session.userId) {
      return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
    }
    
    deleteUser(userId);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// WORK ITEMS API (PROTECTED)
// ============================================

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
app.get('/api/stats/work-items', async (req, res) => {
  try {
    // Force reload database to ensure fresh data
    await reloadDatabase();
    
    const dbPath = path.join(os.homedir(), '.ado-tracker', 'database.db');
    const dbFileTime = fs.statSync(dbPath).mtime.toISOString();
    
    const stats = getWorkItemStats();
    const allItems = getAllWorkItems();
    
    res.json({ 
      success: true, 
      data: {
        ...stats,
        allItems: allItems,
        // Add timestamps for debugging
        timestamp: new Date().toISOString(),
        dbLastModified: dbFileTime
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

// Sync operations (ADMIN ONLY)
app.post('/api/sync', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { projectName, fromDate, maxItems } = req.body;
    
    if (!projectName) {
      return res.status(400).json({ success: false, error: 'Project name required' });
    }

    // Sync only fetches and stores data - no AI tagging
    // Use /api/tags/pending to tag items separately
    const result = await syncWithAzureDevOps(projectName, {
      fromDate,
      maxItems: maxItems || 1000
    });

    res.json({ success: result.success, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Import historical data (ADMIN ONLY)
app.post('/api/import', requireAuth, requireAdmin, async (req, res) => {
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

// Get sync status (ADMIN ONLY)
app.get('/api/sync/status', requireAuth, requireAdmin, (req, res) => {
  try {
    const status = getSyncStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get sync history (ADMIN ONLY)
app.get('/api/sync/history', requireAuth, requireAdmin, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = getSyncHistory(limit);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get pending tag count
app.get('/api/stats/pending-tags', (req, res) => {
  try {
    const db = getDatabase();
    const result = db.exec(`
      SELECT COUNT(*) as count 
      FROM work_items 
      WHERE needs_tagging = 1
    `);
    
    const count = result[0]?.values[0]?.[0] || 0;
    res.json({ success: true, data: { pendingCount: count } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Run AI tagging on pending items (ADMIN ONLY)
app.post('/api/tag-pending', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { batchSize, confidenceThreshold } = req.body;
    
    const result = await tagPendingWorkItems({
      batchSize: batchSize || 10,
      confidenceThreshold: confidenceThreshold || 0.8
    });

    res.json({ success: result.success, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear sync history (ADMIN ONLY)
app.delete('/api/sync/history', requireAuth, requireAdmin, (req, res) => {
  try {
    const db = getDatabase();
    db.run('DELETE FROM sync_log');
    saveDatabase();
    res.json({ success: true, message: 'Sync history cleared' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get sync progress (for live updates) (ADMIN ONLY)
app.get('/api/sync/progress', requireAuth, requireAdmin, (req, res) => {
  try {
    const progress = getSyncProgress();
    res.json({ success: true, data: progress });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Backup database (ADMIN ONLY)
app.post('/api/backup', requireAuth, requireAdmin, (req, res) => {
  try {
    const backupPath = backupDatabase();
    res.json({ success: true, data: { backupPath } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Shrink database (VACUUM) (ADMIN ONLY)
app.post('/api/database/shrink', requireAuth, requireAdmin, (req, res) => {
  try {
    const result = vacuumDatabase();
    res.json({ success: true, data: result });
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

// Tag pending work items using AI (ADMIN ONLY)
app.post('/api/tags/pending', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { batchSize, confidenceThreshold } = req.body;
    
    const result = await tagPendingWorkItems({
      batchSize: batchSize || 10,
      confidenceThreshold: confidenceThreshold || 0.8
    });

    res.json({ success: result.success, data: result });
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

// Get current settings (read-only) (ADMIN ONLY)
app.get('/api/settings', requireAuth, requireAdmin, (req, res) => {
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

// Get all available Azure DevOps projects (ADMIN ONLY)
app.get('/api/projects', requireAuth, requireAdmin, async (req, res) => {
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

// Diagnostic: Analyze orphans (project-aware)
app.get('/api/diagnostics/orphans', (req, res) => {
  try {
    const db = getDatabase();
    
    // Get all projects in database
    const projectsResult = db.exec(`
      SELECT DISTINCT project_name FROM work_items WHERE project_name IS NOT NULL
    `);
    
    const projects = projectsResult[0] ? projectsResult[0].values.map(row => row[0]) : [];
    
    // Analyze orphans PER PROJECT (items without parents within their own project)
    const orphansByProject = {};
    let totalOrphansAcrossProjects = 0;
    
    projects.forEach(project => {
      const orphansInProjectResult = db.exec(`
        SELECT COUNT(*) FROM work_items 
        WHERE project_name = '${project.replace(/'/g, "''")}'  
        AND ado_id NOT IN (
          SELECT wi.ado_id FROM work_items wi
          INNER JOIN work_item_links wil ON wi.ado_id = wil.source_id
          WHERE wi.project_name = '${project.replace(/'/g, "''")}'
          AND (wil.link_type LIKE '%Parent%' OR wil.link_type LIKE '%Hierarchy-Reverse%')
        )
      `);
      
      const projectItemsResult = db.exec(`
        SELECT COUNT(*) FROM work_items WHERE project_name = '${project.replace(/'/g, "''")}'
      `);
      
      const orphanCount = orphansInProjectResult[0]?.values[0]?.[0] || 0;
      const totalCount = projectItemsResult[0]?.values[0]?.[0] || 0;
      
      orphansByProject[project] = {
        orphans: orphanCount,
        total: totalCount,
        percentage: totalCount > 0 ? ((orphanCount / totalCount) * 100).toFixed(1) : 0
      };
      
      totalOrphansAcrossProjects += orphanCount;
    });
    
    // Get orphan samples (top 100)
    const orphansResult = db.exec(`
      SELECT wi.ado_id, wi.title, wi.work_item_type, wi.area_path, wi.project_name
      FROM work_items wi
      WHERE wi.ado_id NOT IN (
        SELECT wil.source_id FROM work_item_links wil
        INNER JOIN work_items wi2 ON wil.source_id = wi2.ado_id
        WHERE wi2.project_name = wi.project_name
        AND (wil.link_type LIKE '%Parent%' OR wil.link_type LIKE '%Hierarchy-Reverse%')
      )
      LIMIT 100
    `);
    
    const orphans = orphansResult[0] ? orphansResult[0].values.map(row => ({
      adoId: row[0],
      title: row[1],
      type: row[2],
      areaPath: row[3],
      projectName: row[4]
    })) : [];
    
    // Get link types used
    const linkTypesResult = db.exec(`
      SELECT DISTINCT link_type, COUNT(*) as count
      FROM work_item_links
      GROUP BY link_type
      ORDER BY count DESC
    `);
    
    const linkTypes = linkTypesResult[0] ? linkTypesResult[0].values.map(row => ({
      linkType: row[0],
      count: row[1]
    })) : [];
    
    // Get orphans by area path (top 20)
    const orphansByAreaResult = db.exec(`
      SELECT area_path, COUNT(*) as count
      FROM work_items wi
      WHERE wi.ado_id NOT IN (
        SELECT wil.source_id FROM work_item_links wil
        INNER JOIN work_items wi2 ON wil.source_id = wi2.ado_id
        WHERE wi2.project_name = wi.project_name
        AND (wil.link_type LIKE '%Parent%' OR wil.link_type LIKE '%Hierarchy-Reverse%')
      )
      GROUP BY area_path
      ORDER BY count DESC
      LIMIT 20
    `);
    
    const orphansByArea = orphansByAreaResult[0] ? orphansByAreaResult[0].values.map(row => ({
      areaPath: row[0],
      count: row[1]
    })) : [];
    
    // Total counts
    const totalItemsResult = db.exec('SELECT COUNT(*) FROM work_items');
    const totalLinksResult = db.exec('SELECT COUNT(*) FROM work_item_links');
    
    res.json({ 
      success: true, 
      data: {
        summary: {
          totalItems: totalItemsResult[0]?.values[0]?.[0] || 0,
          totalLinks: totalLinksResult[0]?.values[0]?.[0] || 0,
          totalOrphans: totalOrphansAcrossProjects,
          projects: projects.length,
          note: 'Orphan count is project-aware: only items without parents WITHIN their own project'
        },
        orphansByProject: orphansByProject,
        orphanSample: orphans,
        linkTypes: linkTypes,
        orphansByArea: orphansByArea
      }
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

// Get per-project statistics
app.get('/api/stats/by-project', (req, res) => {
  try {
    const db = getDatabase();
    
    const projectsResult = db.exec(`SELECT DISTINCT project_name FROM work_items WHERE project_name IS NOT NULL`);
    const projects = projectsResult[0] ? projectsResult[0].values.map(row => row[0]) : [];
    
    const projectStats = {};
    
    projects.forEach(project => {
      const escapedProject = project.replace(/'/g, "''");
      
      const totalResult = db.exec(`SELECT COUNT(*) FROM work_items WHERE project_name = '${escapedProject}'`);
      const total = totalResult[0]?.values[0]?.[0] || 0;
      
      const epicsResult = db.exec(`SELECT COUNT(*) FROM work_items WHERE project_name = '${escapedProject}' AND work_item_type = 'Epic'`);
      const epics = epicsResult[0]?.values[0]?.[0] || 0;
      
      const featuresResult = db.exec(`SELECT COUNT(*) FROM work_items WHERE project_name = '${escapedProject}' AND work_item_type = 'Feature'`);
      const features = featuresResult[0]?.values[0]?.[0] || 0;
      
      const orphansResult = db.exec(`
        SELECT COUNT(*) FROM work_items 
        WHERE project_name = '${escapedProject}'
        AND ado_id NOT IN (
          SELECT wi.ado_id FROM work_items wi
          INNER JOIN work_item_links wil ON wi.ado_id = wil.source_id
          WHERE wi.project_name = '${escapedProject}'
          AND (wil.link_type LIKE '%Parent%' OR wil.link_type LIKE '%Hierarchy-Reverse%')
        )
      `);
      const orphans = orphansResult[0]?.values[0]?.[0] || 0;
      const orphanPercentage = total > 0 ? ((orphans / total) * 100).toFixed(1) : 0;
      
      projectStats[project] = { total, epics, features, orphans, orphanPercentage };
    });
    
    res.json({ success: true, data: projectStats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// RE-TAGGING API ENDPOINTS
// ============================================

// Estimate items to be re-tagged (ADMIN ONLY)
app.post('/api/retag/estimate', requireAuth, requireAdmin, (req, res) => {
  try {
    const result = estimateRetagCount(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Execute re-tagging operation (ADMIN ONLY)
app.post('/api/retag/execute', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await executeRetag(req.body);
    res.json({ success: result.success, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get re-tagging progress (ADMIN ONLY)
app.get('/api/retag/progress', requireAuth, requireAdmin, (req, res) => {
  try {
    const progress = getRetagProgress();
    res.json({ success: true, data: progress });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cancel re-tagging (ADMIN ONLY)
app.post('/api/retag/cancel', requireAuth, requireAdmin, (req, res) => {
  try {
    const result = cancelRetag();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get re-tagging history (ADMIN ONLY)
app.get('/api/retag/history', requireAuth, requireAdmin, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const history = getRetagHistory(limit);
    res.json({ success: true, data: history });
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
    // Initialize users table (must be called after database is initialized)
    try {
      initializeUsersTable();
    } catch (error) {
      console.error('Warning: Could not initialize users table:', error.message);
    }
    
    const server = app.listen(port, () => {
      console.error(`Dashboard server listening on http://localhost:${port}`);
      resolve(server);
    }).on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} in use, trying ${port + 1}`);
        startDashboard(port + 1).then(resolve).catch(reject);
      } else {
        reject(error);
      }
    });
  });
}

export default app;
