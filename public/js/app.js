// MGC ADO Tracker Dashboard JavaScript

// ============================================
// TOAST NOTIFICATION SYSTEM
// ============================================
const ToastManager = {
    show(title, message, type = 'info', duration = 4000) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ'
        };
        
        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                ${message ? `<div class="toast-message">${message}</div>` : ''}
            </div>
            <button class="toast-close" aria-label="Close">×</button>
        `;
        
        container.appendChild(toast);
        
        // Close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            this.remove(toast);
        });
        
        // Auto remove
        if (duration > 0) {
            setTimeout(() => this.remove(toast), duration);
        }
        
        return toast;
    },
    
    remove(toast) {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    },
    
    success(title, message) {
        return this.show(title, message, 'success');
    },
    
    error(title, message) {
        return this.show(title, message, 'error', 6000);
    },
    
    warning(title, message) {
        return this.show(title, message, 'warning', 5000);
    },
    
    info(title, message) {
        return this.show(title, message, 'info');
    }
};

// Add slideOutRight animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOutRight {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(100%); }
    }
`;
document.head.appendChild(style);

// ============================================
// EMPTY STATE HELPERS
// ============================================
function showEmptyState(containerId, config) {
    const container = document.getElementById(containerId);
    const { icon = '📁', title, message, action } = config;
    
    let html = `
        <div class="empty-state">
            <div class="empty-state-icon">${icon}</div>
            <h3>${title}</h3>
            <p>${message}</p>
    `;
    
    if (action) {
        html += `<button class="primary-btn" onclick="${action.onClick}">${action.text}</button>`;
    }
    
    html += `</div>`;
    container.innerHTML = html;
}

// ============================================
// SYNC STATUS INDICATOR
// ============================================
async function updateSyncStatusIndicator() {
    try {
        const response = await fetch('/api/stats/database');
        const data = await response.json();
        const indicator = document.getElementById('sync-status-indicator');
        
        if (data.success && data.data.lastSync) {
            const lastSync = new Date(data.data.lastSync);
            const now = new Date();
            const diffMinutes = Math.floor((now - lastSync) / 60000);
            
            let timeAgo;
            if (diffMinutes < 1) {
                timeAgo = 'just now';
            } else if (diffMinutes < 60) {
                timeAgo = `${diffMinutes}m ago`;
            } else if (diffMinutes < 1440) {
                timeAgo = `${Math.floor(diffMinutes / 60)}h ago`;
            } else {
                timeAgo = `${Math.floor(diffMinutes / 1440)}d ago`;
            }
            
            indicator.innerHTML = `
                <div style="text-align: right;">
                    <span class="status-badge synced">Synced</span>
                    <div style="font-size: 11px; color: var(--text-tertiary); margin-top: 4px;">Last sync: ${timeAgo}</div>
                </div>
            `;
        } else {
            indicator.innerHTML = `<span class="status-badge error">Not Synced</span>`;
        }
    } catch (error) {
        console.error('Error updating sync status:', error);
    }
}

// Update sync status on load and every 30 seconds
document.addEventListener('DOMContentLoaded', () => {
    updateSyncStatusIndicator();
    setInterval(updateSyncStatusIndicator, 30000);
});

// ============================================
// KEYBOARD SHORTCUTS
// ============================================
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K: Focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector('.tab-btn[data-tab="search"]').click();
        setTimeout(() => document.getElementById('search-query').focus(), 100);
        ToastManager.info('Search', 'Press Enter to search');
    }
    
    // Ctrl/Cmd + S: Go to Sync tab
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        document.querySelector('.tab-btn[data-tab="sync"]').click();
    }
    
    // Escape: Clear search or close modals
    if (e.key === 'Escape') {
        const modal = document.getElementById('modal');
        const syncModal = document.getElementById('sync-console-modal');
        
        if (modal.style.display === 'block') {
            modal.style.display = 'none';
        } else if (syncModal.style.display === 'block') {
            syncModal.style.display = 'none';
        } else if (document.querySelector('.tab-btn.active').dataset.tab === 'search') {
            clearSearch();
        }
    }
});

// ============================================
// TAB SWITCHING
// ============================================
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

// Store search results globally for sorting
let currentSearchResults = [];

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
    const headerDiv = document.getElementById('search-results-header');
    resultsDiv.innerHTML = '<p class="loading">Searching...</p>';
    headerDiv.style.display = 'none';
    
    try {
        const response = await fetch(`/api/work-items/search?${params}`);
        const data = await response.json();
        
        if (data.success && data.data.length > 0) {
            currentSearchResults = data.data;
            
            // Show results header with count
            const count = data.data.length;
            document.getElementById('search-results-count').textContent = `Found ${count} work item${count !== 1 ? 's' : ''}`;
            headerDiv.style.display = 'flex';
            
            // Reset sort dropdown
            document.getElementById('search-sort').value = 'relevance';
            
            displaySearchResults(currentSearchResults);
        } else {
            headerDiv.style.display = 'none';
            showEmptyState('search-results', {
                icon: '📂',
                title: 'No Work Items Found',
                message: 'No matches for your search. Try different keywords or filters.'
            });
        }
    } catch (error) {
        headerDiv.style.display = 'none';
        resultsDiv.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
}

// Sort dropdown handler
document.getElementById('search-sort').addEventListener('change', (e) => {
    const sortBy = e.target.value;
    const sorted = [...currentSearchResults];
    
    switch(sortBy) {
        case 'newest':
            sorted.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
            break;
        case 'oldest':
            sorted.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
            break;
        case 'title':
            sorted.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case 'updated':
            sorted.sort((a, b) => new Date(b.modified_date) - new Date(a.modified_date));
            break;
        default:
            // relevance - keep original order
            break;
    }
    
    displaySearchResults(sorted);
});

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
    document.getElementById('search-results-header').style.display = 'none';
    currentSearchResults = [];
    
    showEmptyState('search-results', {
        icon: '🔍',
        title: 'Ready to Search',
        message: 'Enter keywords, select filters, or browse by tags to find work items. Try searching for "authentication", "mobile bug", or "side menu".'
    });
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
            
            // Display new statistics
            const data = workItemStats.data;
            
            // Hierarchy stats
            document.getElementById('stat-epics').textContent = data.epicCount || 0;
            document.getElementById('stat-features').textContent = data.featureCount || 0;
            document.getElementById('stat-orphans').textContent = data.orphanCount || 0;
            document.getElementById('stat-parents').textContent = data.itemsWithChildren || 0;
            document.getElementById('stat-avg-children').textContent = data.avgChildrenPerParent || 0;
            document.getElementById('stat-max-depth').textContent = data.maxHierarchyDepth || 0;
            
            // Health stats
            document.getElementById('stat-tagging-progress').textContent = data.taggingProgress + '%';
            document.getElementById('stat-tagged-count').textContent = data.taggedCount || 0;
            document.getElementById('stat-total-count').textContent = data.totalCount || 0;
            document.getElementById('stat-avg-tags').textContent = data.avgTagsPerItem || 0;
            document.getElementById('stat-no-desc').textContent = data.itemsWithoutDescription || 0;
            document.getElementById('stat-completion-rate').textContent = data.completionRate + '%';
            document.getElementById('stat-stale-30').textContent = data.staleItems30Days || 0;
            document.getElementById('stat-stale-60').textContent = data.staleItems60Days || 0;
            document.getElementById('stat-stale-90').textContent = data.staleItems90Days || 0;
            
            // Time-based stats
            document.getElementById('stat-created-week').textContent = data.itemsCreatedThisWeek || 0;
            document.getElementById('stat-created-month').textContent = data.itemsCreatedThisMonth || 0;
            document.getElementById('stat-closed-week').textContent = data.itemsClosedThisWeek || 0;
            document.getElementById('stat-closed-month').textContent = data.itemsClosedThisMonth || 0;
            document.getElementById('stat-avg-age').textContent = (data.avgAgeOpenItems || 0) + ' days';
            
            if (data.oldestOpenItem) {
                document.getElementById('stat-oldest-age').textContent = data.oldestOpenItem.ageDays + ' days';
                document.getElementById('stat-oldest-title').textContent = '#' + data.oldestOpenItem.id;
                // Store for onclick handler
                window.oldestOpenItemId = data.oldestOpenItem.id;
            } else {
                document.getElementById('stat-oldest-age').textContent = 'N/A';
                document.getElementById('stat-oldest-title').textContent = 'No open items';
            }
            
            // Load project filter
            loadStatsProjectFilter();
            
            // Display initial charts (all projects)
            displayStatsCharts('');
        }
        
        if (tags.success) {
            displayTopTags(tags.data.slice(0, 20));
        }
        
        // Make hierarchy stat cards clickable
        makeStatsClickable();
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// ============================================
// CLICKABLE STATS CARDS
// ============================================
function makeStatsClickable() {
    // Orphans card
    const orphansCard = document.getElementById('stat-orphans').closest('.stat-card');
    if (orphansCard) {
        orphansCard.style.cursor = 'pointer';
        orphansCard.onclick = () => searchByTag('orphan');
        orphansCard.title = 'Click to view orphan items';
    }
    
    // Items with Children card
    const parentsCard = document.getElementById('stat-parents').closest('.stat-card');
    if (parentsCard) {
        parentsCard.style.cursor = 'pointer';
        parentsCard.onclick = () => searchByTag('has-parent');
        parentsCard.title = 'Click to view items with children';
    }
    
    // Epics card
    const epicsCard = document.getElementById('stat-epics').closest('.stat-card');
    if (epicsCard) {
        epicsCard.style.cursor = 'pointer';
        epicsCard.onclick = () => searchByType('Epic');
        epicsCard.title = 'Click to view all epics';
    }
    
    // Features card
    const featuresCard = document.getElementById('stat-features').closest('.stat-card');
    if (featuresCard) {
        featuresCard.style.cursor = 'pointer';
        featuresCard.onclick = () => searchByType('Feature');
        featuresCard.title = 'Click to view all features';
    }
}

function searchByTag(tag) {
    // Switch to search tab
    document.querySelector('.tab-btn[data-tab="search"]').click();
    
    // Set the tag filter
    document.getElementById('filter-tags').value = tag;
    
    // Trigger search
    setTimeout(() => {
        performSearch();
        ToastManager.info('Filtered', `Showing items tagged with "${tag}"`);
    }, 100);
}

function searchByType(type) {
    // Switch to search tab
    document.querySelector('.tab-btn[data-tab="search"]').click();
    
    // Set the type filter
    document.getElementById('filter-type').value = type;
    
    // Trigger search
    setTimeout(() => {
        performSearch();
        ToastManager.info('Filtered', `Showing all ${type}s`);
    }, 100);
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
    
    // If no project filter, use SERVER-CALCULATED stats (they're accurate)
    // Only recalculate when filtering by project
    if (!projectFilter) {
        // Use server stats directly - they're already correct
        document.getElementById('stat-epics').textContent = data.epicCount || 0;
        document.getElementById('stat-features').textContent = data.featureCount || 0;
        document.getElementById('stat-orphans').textContent = data.orphanCount || 0;
        document.getElementById('stat-parents').textContent = data.itemsWithChildren || 0;
        document.getElementById('stat-avg-children').textContent = data.avgChildrenPerParent || 0;
        document.getElementById('stat-max-depth').textContent = data.maxHierarchyDepth || 0;
        
        document.getElementById('stat-tagging-progress').textContent = data.taggingProgress + '%';
        document.getElementById('stat-tagged-count').textContent = data.taggedCount || 0;
        document.getElementById('stat-total-count').textContent = data.totalCount || 0;
        document.getElementById('stat-avg-tags').textContent = data.avgTagsPerItem || 0;
        document.getElementById('stat-no-desc').textContent = data.itemsWithoutDescription || 0;
        document.getElementById('stat-completion-rate').textContent = data.completionRate + '%';
        document.getElementById('stat-stale-30').textContent = data.staleItems30Days || 0;
        document.getElementById('stat-stale-60').textContent = data.staleItems60Days || 0;
        document.getElementById('stat-stale-90').textContent = data.staleItems90Days || 0;
        
        document.getElementById('stat-created-week').textContent = data.itemsCreatedThisWeek || 0;
        document.getElementById('stat-created-month').textContent = data.itemsCreatedThisMonth || 0;
        document.getElementById('stat-closed-week').textContent = data.itemsClosedThisWeek || 0;
        document.getElementById('stat-closed-month').textContent = data.itemsClosedThisMonth || 0;
        document.getElementById('stat-avg-age').textContent = (data.avgAgeOpenItems || 0) + ' days';
        
        if (data.oldestOpenItem) {
            document.getElementById('stat-oldest-age').textContent = data.oldestOpenItem.ageDays + ' days';
            document.getElementById('stat-oldest-title').textContent = '#' + data.oldestOpenItem.id;
            window.oldestOpenItemId = data.oldestOpenItem.id;
        } else {
            document.getElementById('stat-oldest-age').textContent = 'N/A';
            document.getElementById('stat-oldest-title').textContent = 'No open items';
        }
        
        // Calculate chart stats from filtered items
        const byType = {};
        const byState = {};
        const byProject = {};
        
        items.forEach(item => {
            byType[item.work_item_type] = (byType[item.work_item_type] || 0) + 1;
            byState[item.state] = (byState[item.state] || 0) + 1;
            if (item.project_name) {
                byProject[item.project_name] = (byProject[item.project_name] || 0) + 1;
            }
        });
        
        const byTypeArray = Object.entries(byType).map(([type, count]) => ({ type, count }));
        const byStateArray = Object.entries(byState).map(([state, count]) => ({ state, count }));
        const byProjectArray = Object.entries(byProject).map(([project, count]) => ({ project, count }));
        
        displayChart('chart-by-type', byTypeArray);
        displayChart('chart-by-state', byStateArray);
        displayProjectChart('chart-by-project', byProjectArray);
        return;
    }
    
    // Recalculate ALL statistics from filtered items
    
    // HIERARCHY & RELATIONSHIP STATS
    const epicCount = items.filter(item => item.work_item_type === 'Epic').length;
    const featureCount = items.filter(item => item.work_item_type === 'Feature').length;
    
    // Count orphans and items with children from filtered set
    const itemIds = new Set(items.map(item => item.ado_id));
    const itemsWithParent = new Set();
    const itemsWithChildren = new Set();
    
    // Check parent-child relationships within filtered items
    items.forEach(item => {
        if (item.links) {
            item.links.forEach(link => {
                if (link.link_type && link.link_type.toLowerCase().includes('parent')) {
                    if (itemIds.has(link.target_id)) {
                        itemsWithParent.add(item.ado_id);
                        itemsWithChildren.add(link.target_id);
                    }
                }
            });
        }
    });
    
    const orphanCount = items.length - itemsWithParent.size;
    const parentCount = itemsWithChildren.size;
    const avgChildren = parentCount > 0 ? (itemsWithParent.size / parentCount).toFixed(1) : 0;
    
    // WORK ITEM HEALTH
    const totalCount = items.length;
    const taggedCount = items.filter(item => {
        if (!item.tags) return false;
        try {
            const tags = typeof item.tags === 'string' ? JSON.parse(item.tags) : item.tags;
            return Array.isArray(tags) && tags.length > 0;
        } catch (e) {
            return false;
        }
    }).length;
    
    const taggingProgress = totalCount > 0 ? ((taggedCount / totalCount) * 100).toFixed(1) : 0;
    
    let totalTags = 0;
    let itemsWithTags = 0;
    items.forEach(item => {
        if (item.tags) {
            try {
                const tags = typeof item.tags === 'string' ? JSON.parse(item.tags) : item.tags;
                if (Array.isArray(tags) && tags.length > 0) {
                    totalTags += tags.length;
                    itemsWithTags++;
                }
            } catch (e) {}
        }
    });
    const avgTags = itemsWithTags > 0 ? (totalTags / itemsWithTags).toFixed(1) : 0;
    
    const noDescCount = items.filter(item => {
        return !item.description || item.description === '' || item.description === '""';
    }).length;
    
    const completedCount = items.filter(item => 
        item.state === 'Resolved' || item.state === 'Closed'
    ).length;
    const completionRate = totalCount > 0 ? ((completedCount / totalCount) * 100).toFixed(1) : 0;
    
    // Stale items (last 30/60/90 days)
    const now = new Date();
    const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const days60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const days90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    
    const stale30 = items.filter(item => {
        const modDate = new Date(item.modified_date);
        return modDate < days30 && item.state !== 'Closed' && item.state !== 'Resolved';
    }).length;
    
    const stale60 = items.filter(item => {
        const modDate = new Date(item.modified_date);
        return modDate < days60 && item.state !== 'Closed' && item.state !== 'Resolved';
    }).length;
    
    const stale90 = items.filter(item => {
        const modDate = new Date(item.modified_date);
        return modDate < days90 && item.state !== 'Closed' && item.state !== 'Resolved';
    }).length;
    
    // TIME-BASED STATS
    const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const month = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const createdWeek = items.filter(item => new Date(item.created_date) >= week).length;
    const createdMonth = items.filter(item => new Date(item.created_date) >= month).length;
    const closedWeek = items.filter(item => item.closed_date && new Date(item.closed_date) >= week).length;
    const closedMonth = items.filter(item => item.closed_date && new Date(item.closed_date) >= month).length;
    
    // Average age of open items
    const openItems = items.filter(item => item.state !== 'Closed' && item.state !== 'Resolved');
    let totalAge = 0;
    openItems.forEach(item => {
        const created = new Date(item.created_date);
        const age = Math.floor((now - created) / (24 * 60 * 60 * 1000));
        totalAge += age;
    });
    const avgAge = openItems.length > 0 ? Math.round(totalAge / openItems.length) : 0;
    
    // Oldest open item
    let oldestItem = null;
    let oldestAge = 0;
    openItems.forEach(item => {
        const created = new Date(item.created_date);
        const age = Math.floor((now - created) / (24 * 60 * 60 * 1000));
        if (age > oldestAge) {
            oldestAge = age;
            oldestItem = item;
        }
    });
    
    // UPDATE ALL STAT DISPLAYS
    
    // Hierarchy stats
    document.getElementById('stat-epics').textContent = epicCount;
    document.getElementById('stat-features').textContent = featureCount;
    document.getElementById('stat-orphans').textContent = orphanCount;
    document.getElementById('stat-parents').textContent = parentCount;
    document.getElementById('stat-avg-children').textContent = avgChildren;
    // Max depth would require recursive calculation - skip for now
    
    // Health stats
    document.getElementById('stat-tagging-progress').textContent = taggingProgress + '%';
    document.getElementById('stat-tagged-count').textContent = taggedCount;
    document.getElementById('stat-total-count').textContent = totalCount;
    document.getElementById('stat-avg-tags').textContent = avgTags;
    document.getElementById('stat-no-desc').textContent = noDescCount;
    document.getElementById('stat-completion-rate').textContent = completionRate + '%';
    document.getElementById('stat-stale-30').textContent = stale30;
    document.getElementById('stat-stale-60').textContent = stale60;
    document.getElementById('stat-stale-90').textContent = stale90;
    
    // Time-based stats
    document.getElementById('stat-created-week').textContent = createdWeek;
    document.getElementById('stat-created-month').textContent = createdMonth;
    document.getElementById('stat-closed-week').textContent = closedWeek;
    document.getElementById('stat-closed-month').textContent = closedMonth;
    document.getElementById('stat-avg-age').textContent = avgAge + ' days';
    
    if (oldestItem) {
        document.getElementById('stat-oldest-age').textContent = oldestAge + ' days';
        document.getElementById('stat-oldest-title').textContent = '#' + oldestItem.ado_id;
        window.oldestOpenItemId = oldestItem.ado_id;
    } else {
        document.getElementById('stat-oldest-age').textContent = 'N/A';
        document.getElementById('stat-oldest-title').textContent = 'No open items';
    }
    
    // Calculate stats for charts
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
            ToastManager.success('Database Backed Up', `Backup saved to ${data.data.backupPath.split('\\').pop()}`);
        } else {
            btn.textContent = originalText;
            btn.disabled = false;
            ToastManager.error('Backup Failed', data.error);
        }
    } catch (error) {
        btn.textContent = originalText;
        btn.disabled = false;
        ToastManager.error('Backup Error', error.message);
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
            ToastManager.success('Database Shrunk', `Reclaimed ${data.data.reclaimedMB}MB (${data.data.beforeSizeMB}MB → ${data.data.afterSizeMB}MB)`);
            loadSettings(); // Refresh size display
        } else {
            btn.textContent = originalText;
            btn.disabled = false;
            ToastManager.error('Shrink Failed', data.error);
        }
    } catch (error) {
        btn.textContent = originalText;
        btn.disabled = false;
        ToastManager.error('Shrink Error', error.message);
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

document.getElementById('export-csv-btn').addEventListener('click', () => {
    window.location.href = '/api/export/csv';
});

document.getElementById('export-excel-btn').addEventListener('click', () => {
    window.location.href = '/api/export/excel';
});

document.getElementById('refresh-stats-btn').addEventListener('click', () => {
    loadStats();
    loadSettings();
    alert('Stats refreshed!');
});

// Show oldest open item
function showOldestItem() {
    if (window.oldestOpenItemId) {
        showWorkItemDetails(window.oldestOpenItemId);
    }
}
