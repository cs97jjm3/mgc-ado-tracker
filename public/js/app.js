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
            prefillSyncProject();
            loadPendingTagCount();
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
            resultsDiv.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📂</div>
                    <h3>No Work Items Found</h3>
                    <p>No matches for your search. Try different keywords or filters.</p>
                    <button onclick="clearSearch()" class="secondary-btn">Clear Search</button>
                </div>
            `;
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
                    <div class="work-item-id">#${item.ado_id} ${item.project_name ? `<span style="color: #999; font-size: 12px;">• ${item.project_name}</span>` : ''}</div>
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
    document.getElementById('filter-project').value = '';
    document.getElementById('filter-type').value = '';
    document.getElementById('filter-state').value = '';
    document.getElementById('filter-tags').value = '';
    document.getElementById('search-results').innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <h3>Ready to Search</h3>
            <p>Enter keywords, select filters, or browse by tags to find work items.<br/>
            Try: "authentication", "mobile bug", or "side menu"</p>
        </div>
    `;
}

async function showWorkItemDetails(adoId) {
    try {
        const [itemResponse, settingsResponse] = await Promise.all([
            fetch(`/api/work-items/${adoId}`),
            fetch('/api/settings')
        ]);
        const itemData = await itemResponse.json();
        const settingsData = await settingsResponse.json();
        
        if (itemData.success) {
            const item = itemData.data;
            const modalBody = document.getElementById('modal-body');
            
            // Build Azure DevOps URL
            let adoUrl = '#';
            if (settingsData.success && settingsData.data.env && settingsData.data.env.ADO_ORG_URL) {
                const orgUrl = settingsData.data.env.ADO_ORG_URL;
                const project = item.project_name || settingsData.data.env.ADO_PROJECT || '';
                adoUrl = `${orgUrl}/${encodeURIComponent(project)}/_workitems/edit/${item.ado_id}`;
            }
            
            modalBody.innerHTML = `
                <h2>${escapeHtml(item.title)}</h2>
                <p><strong>ID:</strong> <a href="${adoUrl}" target="_blank" rel="noopener noreferrer" style="color: #667eea; text-decoration: none;">#${item.ado_id} 🔗</a></p>
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
            // Store data globally for filtering
            window.statsData = workItemStats.data;
            
            // Load project filter
            loadStatsProjectFilter();
            
            // Display initial charts (all projects)
            displayStatsCharts('');
        }
        
        if (tags.success) {
            displayTopTags(tags.data.slice(0, 20));
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function loadStatsProjectFilter() {
    const select = document.getElementById('stats-project-filter');
    const allItems = window.statsData.allItems || [];
    
    // Get unique projects
    const projects = [...new Set(allItems.map(item => item.project_name).filter(Boolean))];
    projects.sort();
    
    // Clear and repopulate
    select.innerHTML = '<option value="">All Projects</option>';
    projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project;
        option.textContent = project;
        select.appendChild(option);
    });
    
    // Add change listener
    select.addEventListener('change', (e) => {
        displayStatsCharts(e.target.value);
    });
}

function displayStatsCharts(projectFilter) {
    const data = window.statsData;
    if (!data) return;
    
    let items = data.allItems || [];
    
    // Filter by project if selected
    if (projectFilter) {
        items = items.filter(item => item.project_name === projectFilter);
    }
    
    // Calculate stats from filtered items
    const byType = {};
    const byState = {};
    const byProject = {};
    
    items.forEach(item => {
        // By Type
        byType[item.work_item_type] = (byType[item.work_item_type] || 0) + 1;
        
        // By State
        byState[item.state] = (byState[item.state] || 0) + 1;
        
        // By Project
        if (item.project_name) {
            byProject[item.project_name] = (byProject[item.project_name] || 0) + 1;
        }
    });
    
    // Convert to array format
    const byTypeArray = Object.entries(byType).map(([type, count]) => ({ type, count }));
    const byStateArray = Object.entries(byState).map(([state, count]) => ({ state, count }));
    const byProjectArray = Object.entries(byProject).map(([project, count]) => ({ project, count }));
    
    displayChart('chart-by-type', byTypeArray);
    displayChart('chart-by-state', byStateArray);
    displayProjectChart('chart-by-project', byProjectArray);
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

function displayProjectChart(elementId, data) {
    const element = document.getElementById(elementId);
    
    if (data.length === 0) {
        element.innerHTML = '<p>No projects found</p>';
        return;
    }
    
    // Sort by count descending
    data.sort((a, b) => b.count - a.count);
    
    const maxCount = Math.max(...data.map(d => d.count));
    
    const colors = [
        'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(90deg, #f093fb 0%, #f5576c 100%)',
        'linear-gradient(90deg, #4facfe 0%, #00f2fe 100%)',
        'linear-gradient(90deg, #43e97b 0%, #38f9d7 100%)',
        'linear-gradient(90deg, #fa709a 0%, #fee140 100%)',
        'linear-gradient(90deg, #30cfd0 0%, #330867 100%)'
    ];
    
    const html = data.map((item, index) => {
        const width = (item.count / maxCount) * 100;
        const color = colors[index % colors.length];
        
        return `
            <div class="chart-bar">
                <div class="chart-label">${item.project}</div>
                <div class="chart-bar-fill" style="width: ${width}%; background: ${color};">${item.count}</div>
            </div>
        `;
    }).join('');
    
    element.innerHTML = html;
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
document.getElementById('clear-sync-history-btn').addEventListener('click', clearSyncHistory);

// AI Tagging functionality
document.getElementById('tag-btn').addEventListener('click', startAITagging);

async function loadPendingTagCount() {
    try {
        const response = await fetch('/api/stats/pending-tags');
        const data = await response.json();
        
        if (data.success) {
            const count = data.data.pendingCount || 0;
            document.getElementById('pending-tag-count').textContent = count.toLocaleString();
        }
    } catch (error) {
        console.error('Error loading pending tag count:', error);
        document.getElementById('pending-tag-count').textContent = 'Error';
    }
}

async function startAITagging() {
    const batchSize = parseInt(document.getElementById('tag-batch-size').value);
    
    if (batchSize < 1 || batchSize > 50) {
        alert('Batch size must be between 1 and 50');
        return;
    }
    
    const tagBtn = document.getElementById('tag-btn');
    tagBtn.disabled = true;
    tagBtn.textContent = '🤖 Tagging...';
    
    try {
        logToConsole('info', `Starting AI tagging for ${batchSize} items...`);
        logToConsole('separator');
        
        const response = await fetch('/api/tag-pending', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batchSize })
        });
        
        const data = await response.json();
        
        if (data.success) {
            logToConsole('success', `✓ AI tagging completed!`);
            logToConsole('info', `Items tagged: ${data.data.itemsTagged}`);
            logToConsole('info', `Items failed: ${data.data.itemsFailed}`);
            logToConsole('info', `Duration: ${(data.data.durationMs / 1000).toFixed(2)}s`);
            
            if (data.data.errors && data.data.errors.length > 0) {
                logToConsole('warning', `Warnings: ${data.data.errors.length} items had issues`);
            }
            
            // Refresh pending count
            loadPendingTagCount();
        } else {
            logToConsole('error', `✗ AI tagging failed: ${data.error}`);
        }
    } catch (error) {
        logToConsole('error', `✗ Error: ${error.message}`);
    } finally {
        tagBtn.disabled = false;
        tagBtn.textContent = '🏷️ Run AI Tagging';
    }
}

async function prefillSyncProject() {
    const select = document.getElementById('sync-project');
    
    try {
        // Fetch all available projects from Azure DevOps
        const response = await fetch('/api/projects');
        const data = await response.json();
        
        if (data.success && data.data.length > 0) {
            // Clear loading option
            select.innerHTML = '<option value="">Select a project...</option>';
            
            // Get default project from settings
            const settingsResponse = await fetch('/api/settings');
            const settingsData = await settingsResponse.json();
            const defaultProject = settingsData.data?.env?.ADO_PROJECT || '';
            
            // Sort projects alphabetically
            const sortedProjects = data.data.sort((a, b) => a.name.localeCompare(b.name));
            
            // Add all projects
            sortedProjects.forEach(project => {
                const option = document.createElement('option');
                option.value = project.name;
                option.textContent = project.name;
                if (project.name === defaultProject) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        } else {
            select.innerHTML = '<option value="">No projects available</option>';
        }
    } catch (error) {
        console.error('Error loading projects:', error);
        select.innerHTML = '<option value="">Error loading projects</option>';
    }
}

async function startSync() {
    const projectName = document.getElementById('sync-project').value;
    const fromDate = document.getElementById('sync-from-date').value;
    const maxItems = parseInt(document.getElementById('sync-max-items').value);
    
    if (!projectName) {
        alert('Please select a project');
        return;
    }
    
    // Show sync console
    showSyncConsole();
    
    const syncBtn = document.getElementById('sync-btn');
    syncBtn.disabled = true;
    syncBtn.textContent = 'Syncing...';
    
    // Start polling for progress
    const pollInterval = startProgressPolling();
    
    try {
        logToConsole('info', `Starting sync for project: ${projectName}`);
        if (fromDate) logToConsole('info', `Syncing items modified after: ${fromDate}`);
        logToConsole('info', `Max items: ${maxItems}`);
        logToConsole('separator');
        
        const response = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectName, fromDate, maxItems })
        });
        
        const data = await response.json();
        
        // Stop polling
        clearInterval(pollInterval);
        
        if (data.success) {
            logToConsole('success', `✓ Sync completed successfully!`);
            logToConsole('info', `Items added: ${data.data.itemsAdded}`);
            logToConsole('info', `Items updated: ${data.data.itemsUpdated}`);
            logToConsole('info', `Duration: ${(data.data.durationMs / 1000).toFixed(2)}s`);
            
            if (data.data.errors && data.data.errors.length > 0) {
                logToConsole('warning', `Warnings: ${data.data.errors.length} items had issues`);
            }
            
            updateSyncProgress(100);
            
            loadSyncStatus();
            loadSyncHistory();
        } else {
            logToConsole('error', `✗ Sync failed: ${data.error}`);
            updateSyncProgress(0);
        }
    } catch (error) {
        clearInterval(pollInterval);
        logToConsole('error', `✗ Error: ${error.message}`);
        updateSyncProgress(0);
    } finally {
        syncBtn.disabled = false;
        syncBtn.textContent = 'Start Sync';
    }
}

function startProgressPolling() {
    return setInterval(async () => {
        try {
            const response = await fetch('/api/sync/progress');
            const data = await response.json();
            
            if (data.success && data.data.inProgress) {
                const progress = data.data;
                
                // Update progress bar
                updateSyncProgress(progress.percentage);
                
                // Log current item being processed
                if (progress.currentItem) {
                    logToConsole('info', progress.currentItem);
                }
            }
        } catch (error) {
            console.error('Error polling progress:', error);
        }
    }, 500); // Poll every 500ms
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

async function clearSyncHistory() {
    if (!confirm('Clear all sync history? This cannot be undone.')) {
        return;
    }
    
    const btn = document.getElementById('clear-sync-history-btn');
    const originalText = btn.textContent;
    
    try {
        btn.disabled = true;
        btn.textContent = 'Clearing...';
        
        const response = await fetch('/api/sync/history', { method: 'DELETE' });
        const data = await response.json();
        
        if (data.success) {
            btn.textContent = '✓ Cleared!';
            btn.classList.add('success-flash');
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
                btn.classList.remove('success-flash');
            }, 2000);
            
            // Reload sync history to show empty state
            loadSyncHistory();
        } else {
            btn.textContent = originalText;
            btn.disabled = false;
            alert(`Failed to clear history: ${data.error}`);
        }
    } catch (error) {
        btn.textContent = originalText;
        btn.disabled = false;
        alert(`Error: ${error.message}`);
    }
}

// Settings
document.getElementById('backup-btn').addEventListener('click', backupDatabase);
document.getElementById('shrink-btn').addEventListener('click', shrinkDatabase);
document.getElementById('export-csv-btn').addEventListener('click', exportCSV);
document.getElementById('export-excel-btn').addEventListener('click', exportExcel);
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
            document.getElementById('db-size-display').textContent = `${dbData.data.dbSizeMB} MB`;
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
    const btn = document.getElementById('backup-btn');
    const originalText = btn.textContent;
    
    try {
        btn.disabled = true;
        btn.textContent = 'Backing up...';
        
        const response = await fetch('/api/backup', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            btn.textContent = '✓ Backed up!';
            btn.classList.add('success-flash');
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
                btn.classList.remove('success-flash');
            }, 2000);
            alert(`Database backed up to:\n${data.data.backupPath}`);
        } else {
            btn.textContent = originalText;
            btn.disabled = false;
            alert(`Backup failed: ${data.error}`);
        }
    } catch (error) {
        btn.textContent = originalText;
        btn.disabled = false;
        alert(`Error: ${error.message}`);
    }
}

async function shrinkDatabase() {
    const btn = document.getElementById('shrink-btn');
    const originalText = btn.textContent;
    
    if (!confirm('Shrink database? This will reclaim unused space.')) {
        return;
    }
    
    try {
        btn.disabled = true;
        btn.textContent = 'Shrinking...';
        
        const response = await fetch('/api/database/shrink', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            btn.textContent = '✓ Shrunk!';
            btn.classList.add('success-flash');
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
                btn.classList.remove('success-flash');
            }, 2000);
            alert(data.data.message);
            loadSettings(); // Refresh size display
        } else {
            btn.textContent = originalText;
            btn.disabled = false;
            alert(`Shrink failed: ${data.error}`);
        }
    } catch (error) {
        btn.textContent = originalText;
        btn.disabled = false;
        alert(`Error: ${error.message}`);
    }
}

function exportCSV() {
    const btn = document.getElementById('export-csv-btn');
    const originalText = btn.textContent;
    
    btn.disabled = true;
    btn.textContent = 'Exporting...';
    
    // Trigger download
    window.location.href = '/api/export/csv';
    
    setTimeout(() => {
        btn.textContent = '✓ Downloaded!';
        btn.classList.add('success-flash');
        setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
            btn.classList.remove('success-flash');
        }, 2000);
    }, 500);
}

function exportExcel() {
    const btn = document.getElementById('export-excel-btn');
    const originalText = btn.textContent;
    
    btn.disabled = true;
    btn.textContent = 'Exporting...';
    
    // Trigger download
    window.location.href = '/api/export/excel';
    
    setTimeout(() => {
        btn.textContent = '✓ Downloaded!';
        btn.classList.add('success-flash');
        setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
            btn.classList.remove('success-flash');
        }, 2000);
    }, 500);
}

// Modal
const modal = document.getElementById('modal');
const closeBtn = document.querySelector('.close');

closeBtn.onclick = () => modal.style.display = 'none';
window.onclick = (e) => {
    if (e.target === modal) modal.style.display = 'none';
};

// Sync Console Modal
const syncConsoleModal = document.getElementById('sync-console-modal');
const syncConsoleClose = document.getElementById('sync-console-close');
const syncConsoleCloseBtn = document.getElementById('sync-console-close-btn');
const syncConsoleClear = document.getElementById('sync-console-clear');

syncConsoleClose.onclick = () => syncConsoleModal.style.display = 'none';
syncConsoleCloseBtn.onclick = () => syncConsoleModal.style.display = 'none';
syncConsoleClear.onclick = clearSyncConsole;

// Help Modal
const helpModal = document.getElementById('help-modal');
const helpClose = document.getElementById('help-close');
const helpCloseBtn = document.getElementById('help-close-btn');
const helpBtn = document.getElementById('help-btn');

helpBtn.onclick = () => helpModal.style.display = 'block';
helpClose.onclick = () => helpModal.style.display = 'none';
helpCloseBtn.onclick = () => helpModal.style.display = 'none';

window.onclick = (e) => {
    if (e.target === modal) modal.style.display = 'none';
    if (e.target === syncConsoleModal) syncConsoleModal.style.display = 'none';
    if (e.target === helpModal) helpModal.style.display = 'none';
};

function showSyncConsole() {
    syncConsoleModal.style.display = 'block';
    clearSyncConsole();
    updateSyncProgress(0);
}

function clearSyncConsole() {
    const console = document.getElementById('sync-console');
    console.innerHTML = '';
}

function logToConsole(type, message) {
    const console = document.getElementById('sync-console');
    const timestamp = new Date().toLocaleTimeString();
    
    let color, prefix;
    switch(type) {
        case 'info':
            color = '#4ec9b0';
            prefix = '[INFO]';
            break;
        case 'success':
            color = '#43e97b';
            prefix = '[SUCCESS]';
            break;
        case 'warning':
            color = '#ffa500';
            prefix = '[WARNING]';
            break;
        case 'error':
            color = '#f48771';
            prefix = '[ERROR]';
            break;
        case 'separator':
            console.innerHTML += '<div style="border-top: 1px solid #444; margin: 10px 0;"></div>';
            return;
        default:
            color = '#d4d4d4';
            prefix = '[LOG]';
    }
    
    const logEntry = document.createElement('div');
    logEntry.innerHTML = `<span style="color: #858585;">${timestamp}</span> <span style="color: ${color};">${prefix}</span> ${escapeHtml(message)}`;
    console.appendChild(logEntry);
    
    // Auto-scroll to bottom
    console.scrollTop = console.scrollHeight;
}

function updateSyncProgress(percentage) {
    const progressBar = document.getElementById('sync-progress-bar');
    progressBar.style.width = percentage + '%';
    progressBar.textContent = percentage > 0 ? `${percentage}%` : '';
}

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
    loadProjectFilter();
});

// Load available projects for filter
async function loadProjectFilter() {
    try {
        const response = await fetch('/api/work-items/search');
        const data = await response.json();
        
        if (data.success && data.data.length > 0) {
            // Get unique project names
            const projects = [...new Set(data.data.map(item => item.project_name).filter(Boolean))];
            
            const select = document.getElementById('filter-project');
            projects.forEach(project => {
                const option = document.createElement('option');
                option.value = project;
                option.textContent = project;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading projects:', error);
    }
}
