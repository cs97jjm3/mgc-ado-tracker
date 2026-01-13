// MGC ADO Tracker Dashboard JavaScript

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        
        // Update buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // Load tab-specific data
        if (tabName === 'stats') {
            loadStats();
        } else if (tabName === 'sync') {
            loadSyncStatus();
            loadSyncHistory();
        } else if (tabName === 'settings') {
            loadSettings();
        }
    });
});

// Search functionality
document.getElementById('search-btn').addEventListener('click', performSearch);
document.getElementById('clear-search-btn').addEventListener('click', clearSearch);
document.getElementById('search-query').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

async function performSearch() {
    const query = document.getElementById('search-query').value;
    const type = document.getElementById('filter-type').value;
    const state = document.getElementById('filter-state').value;
    const tagsInput = document.getElementById('filter-tags').value;
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()) : [];
    
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (type) params.append('type', type);
    if (state) params.append('state', state);
    if (tags.length) params.append('tags', tags.join(','));
    
    const resultsDiv = document.getElementById('search-results');
    resultsDiv.innerHTML = '<p class="loading">Searching...</p>';
    
    try {
        const response = await fetch(`/api/work-items/search?${params}`);
        const data = await response.json();
        
        if (data.success && data.data.length > 0) {
            displaySearchResults(data.data);
        } else {
            resultsDiv.innerHTML = '<p class="placeholder">No work items found</p>';
        }
    } catch (error) {
        resultsDiv.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
}

function displaySearchResults(items) {
    const resultsDiv = document.getElementById('search-results');
    
    const html = items.map(item => `
        <div class="work-item-card" onclick="showWorkItemDetails('${item.ado_id}')">
            <div class="work-item-header">
                <div>
                    <div class="work-item-title">${escapeHtml(item.title)}</div>
                    <div class="work-item-id">#${item.ado_id}</div>
                </div>
                <span class="tag">${item.work_item_type}</span>
            </div>
            <div class="work-item-meta">
                <span>📊 ${item.state}</span>
                <span>📁 ${item.area_path || 'N/A'}</span>
                <span>🔄 ${item.iteration_path || 'N/A'}</span>
            </div>
            <div class="work-item-tags">
                ${(item.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
        </div>
    `).join('');
    
    resultsDiv.innerHTML = html;
}

function clearSearch() {
    document.getElementById('search-query').value = '';
    document.getElementById('filter-type').value = '';
    document.getElementById('filter-state').value = '';
    document.getElementById('filter-tags').value = '';
    document.getElementById('search-results').innerHTML = '<p class="placeholder">Enter a search query or use filters above</p>';
}

async function showWorkItemDetails(adoId) {
    try {
        const response = await fetch(`/api/work-items/${adoId}`);
        const data = await response.json();
        
        if (data.success) {
            const item = data.data;
            const modalBody = document.getElementById('modal-body');
            
            modalBody.innerHTML = `
                <h2>${escapeHtml(item.title)}</h2>
                <p><strong>ID:</strong> #${item.ado_id}</p>
                <p><strong>Type:</strong> ${item.work_item_type}</p>
                <p><strong>State:</strong> ${item.state}</p>
                <p><strong>Area Path:</strong> ${item.area_path || 'N/A'}</p>
                <p><strong>Iteration:</strong> ${item.iteration_path || 'N/A'}</p>
                <p><strong>Assigned To:</strong> ${item.assigned_to || 'Unassigned'}</p>
                <p><strong>Created:</strong> ${formatDate(item.created_date)} by ${item.created_by}</p>
                <p><strong>Modified:</strong> ${formatDate(item.modified_date)}</p>
                <h3>Description</h3>
                <div>${item.description || 'No description'}</div>
                <h3>Tags</h3>
                <div class="work-item-tags">
                    ${(item.tags || []).map(tag => {
                        const confidence = item.confidence_scores?.[tag] || 1;
                        const className = confidence < 0.7 ? 'tag low-confidence' : 'tag';
                        return `<span class="${className}">${tag} (${(confidence * 100).toFixed(0)}%)</span>`;
                    }).join('')}
                </div>
            `;
            
            document.getElementById('modal').style.display = 'block';
        }
    } catch (error) {
        alert(`Error loading work item: ${error.message}`);
    }
}

// Statistics
async function loadStats() {
    try {
        const [dbStats, workItemStats, tags] = await Promise.all([
            fetch('/api/stats/database').then(r => r.json()),
            fetch('/api/stats/work-items').then(r => r.json()),
            fetch('/api/tags').then(r => r.json())
        ]);
        
        if (dbStats.success) {
            document.getElementById('stat-total').textContent = dbStats.data.itemCount;
            document.getElementById('stat-tags').textContent = dbStats.data.tagCount;
            document.getElementById('stat-size').textContent = `${dbStats.data.dbSizeMB} MB`;
            document.getElementById('stat-last-sync').textContent = dbStats.data.lastSync ? formatDate(dbStats.data.lastSync) : 'Never';
        }
        
        if (workItemStats.success) {
            displayChart('chart-by-type', workItemStats.data.byType);
            displayChart('chart-by-state', workItemStats.data.byState);
        }
        
        if (tags.success) {
            displayTopTags(tags.data.slice(0, 20));
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function displayChart(elementId, data) {
    const element = document.getElementById(elementId);
    const maxCount = Math.max(...data.map(d => d.count));
    
    const html = data.map(item => {
        const label = item.type || item.state;
        const width = (item.count / maxCount) * 100;
        
        return `
            <div class="chart-bar">
                <div class="chart-label">${label}</div>
                <div class="chart-bar-fill" style="width: ${width}%;">${item.count}</div>
            </div>
        `;
    }).join('');
    
    element.innerHTML = html || '<p>No data available</p>';
}

function displayTopTags(tags) {
    const element = document.getElementById('top-tags');
    const maxCount = Math.max(...tags.map(t => t.usageCount));
    
    const html = tags.map(tag => {
        const width = (tag.usageCount / maxCount) * 100;
        
        return `
            <div class="chart-bar">
                <div class="chart-label">${tag.tagName}</div>
                <div class="chart-bar-fill" style="width: ${width}%;">${tag.usageCount}</div>
            </div>
        `;
    }).join('');
    
    element.innerHTML = html || '<p>No tags available</p>';
}

// Sync functionality
document.getElementById('sync-btn').addEventListener('click', startSync);
document.getElementById('import-btn').addEventListener('click', startImport);

async function startSync() {
    const projectName = document.getElementById('sync-project').value;
    const fromDate = document.getElementById('sync-from-date').value;
    const maxItems = parseInt(document.getElementById('sync-max-items').value);
    
    if (!projectName) {
        alert('Please enter a project name');
        return;
    }
    
    const syncBtn = document.getElementById('sync-btn');
    syncBtn.disabled = true;
    syncBtn.textContent = 'Syncing...';
    
    try {
        const response = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectName, fromDate, maxItems })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`Sync completed!\nAdded: ${data.data.itemsAdded}\nUpdated: ${data.data.itemsUpdated}`);
            loadSyncStatus();
            loadSyncHistory();
        } else {
            alert(`Sync failed: ${data.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    } finally {
        syncBtn.disabled = false;
        syncBtn.textContent = 'Start Sync';
    }
}

async function startImport() {
    const projectName = document.getElementById('sync-project').value;
    const fromDate = document.getElementById('sync-from-date').value;
    
    if (!projectName) {
        alert('Please enter a project name');
        return;
    }
    
    if (!confirm('This will import all historical data. This may take several minutes. Continue?')) {
        return;
    }
    
    const importBtn = document.getElementById('import-btn');
    importBtn.disabled = true;
    importBtn.textContent = 'Importing...';
    
    try {
        const response = await fetch('/api/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectName, fromDate })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`Import completed!\nAdded: ${data.data.itemsAdded}\nUpdated: ${data.data.itemsUpdated}`);
            loadSyncStatus();
            loadSyncHistory();
        } else {
            alert(`Import failed: ${data.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    } finally {
        importBtn.disabled = false;
        importBtn.textContent = 'Import Historical Data';
    }
}

async function loadSyncStatus() {
    try {
        const response = await fetch('/api/sync/status');
        const data = await response.json();
        
        if (data.success) {
            const status = data.data;
            const element = document.getElementById('sync-status-content');
            
            if (!status.lastSync) {
                element.innerHTML = '<p>No sync performed yet</p>';
            } else {
                element.innerHTML = `
                    <p><strong>Status:</strong> ${status.lastSync.status}</p>
                    <p><strong>Last Sync:</strong> ${formatDate(status.lastSync.date)}</p>
                    <p><strong>Added:</strong> ${status.lastSync.itemsAdded}</p>
                    <p><strong>Updated:</strong> ${status.lastSync.itemsUpdated}</p>
                    <p><strong>Duration:</strong> ${(status.lastSync.durationMs / 1000).toFixed(2)}s</p>
                    ${status.inProgress ? '<p><strong>⚠ Sync in progress</strong></p>' : ''}
                `;
            }
        }
    } catch (error) {
        console.error('Error loading sync status:', error);
    }
}

async function loadSyncHistory() {
    try {
        const response = await fetch('/api/sync/history');
        const data = await response.json();
        
        if (data.success) {
            const element = document.getElementById('sync-history-content');
            
            if (data.data.length === 0) {
                element.innerHTML = '<p>No sync history</p>';
            } else {
                const html = data.data.map(log => `
                    <div class="sync-log-entry ${log.status === 'failed' ? 'failed' : ''}">
                        <div class="sync-log-meta">
                            <span>${formatDate(log.syncDate)}</span>
                            <span>${log.status}</span>
                        </div>
                        <p>Added: ${log.itemsAdded}, Updated: ${log.itemsUpdated}, Duration: ${(log.durationMs / 1000).toFixed(2)}s</p>
                    </div>
                `).join('');
                
                element.innerHTML = html;
            }
        }
    } catch (error) {
        console.error('Error loading sync history:', error);
    }
}

// Settings
document.getElementById('backup-btn').addEventListener('click', backupDatabase);
document.getElementById('refresh-stats-btn').addEventListener('click', loadStats);

async function loadSettings() {
    try {
        const [dbResponse, settingsResponse] = await Promise.all([
            fetch('/api/stats/database'),
            fetch('/api/settings')
        ]);
        
        const dbData = await dbResponse.json();
        const settingsData = await settingsResponse.json();
        
        if (dbData.success) {
            document.getElementById('db-location').textContent = dbData.data.dbPath;
        }
        
        if (settingsData.success && settingsData.data.env) {
            const env = settingsData.data.env;
            
            // Display current configuration
            document.getElementById('config-org-url').textContent = env.ADO_ORG_URL || 'Not configured';
            document.getElementById('config-project').textContent = env.ADO_PROJECT || 'Not configured';
            document.getElementById('config-port').textContent = env.DASHBOARD_PORT || '3738';
            document.getElementById('config-sync').textContent = env.SYNC_ENABLED === 'true' 
                ? `Enabled (every ${env.SYNC_INTERVAL_MINUTES || 60} minutes)` 
                : 'Disabled';
            document.getElementById('config-autotag').textContent = env.AUTO_TAG_NEW_ITEMS !== 'false'
                ? `Enabled (${Math.round((env.TAG_CONFIDENCE_THRESHOLD || 0.7) * 100)}% confidence)` 
                : 'Disabled';
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function backupDatabase() {
    try {
        const response = await fetch('/api/backup', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            alert(`Database backed up to:\n${data.data.backupPath}`);
        } else {
            alert(`Backup failed: ${data.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// Modal
const modal = document.getElementById('modal');
const closeBtn = document.querySelector('.close');

closeBtn.onclick = () => modal.style.display = 'none';
window.onclick = (e) => {
    if (e.target === modal) modal.style.display = 'none';
};

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('MGC ADO Tracker Dashboard loaded');
});
