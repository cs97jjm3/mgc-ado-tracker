# Changelog

All notable changes to MGC ADO Tracker will be documented in this file.

## [1.3.0] - 2025-01-18

### Added - MAJOR: Enhanced Field Extraction
**21 new fields extracted from Azure DevOps:**

**Rich Text Fields (for better search & tagging):**
- `acceptance_criteria` - Acceptance criteria from work items
- `repro_steps` - Reproduction steps for bugs
- `system_info` - System information for bugs

**Planning & Priority:**
- `priority` - Work item priority (1-4)
- `severity` - Bug severity
- `story_points` - Story point estimates
- `business_value` - Business value score
- `risk` - Risk assessment

**Version/Build Info:**
- `found_in_build` - Build where bug was found
- `integration_build` - Integration build info

**Workflow Tracking:**
- `resolved_by` - Who resolved the item
- `resolved_date` - When it was resolved
- `closed_by` - Who closed the item
- `closed_date` - When it was closed
- `activated_by` - Who activated the item
- `activated_date` - When it was activated
- `state_reason` - Reason for current state

**Effort Tracking:**
- `original_estimate` - Original time estimate
- `remaining_work` - Remaining work hours
- `completed_work` - Completed work hours

**ADO Native Tags:**
- `ado_tags` - Azure DevOps native tags (separate from AI tags)

**New Tables:**
- `work_item_attachments` - Track file attachments
- `work_item_hyperlinks` - Track external links
- `link_comment` column added to `work_item_links`

### Enhanced
- **Search now includes acceptance criteria and repro steps** - Find stories by "documentation updated" in acceptance criteria
- **AI tagging uses richer context** - Analyzes acceptance criteria and repro steps for better tags
- **Automatic field extraction during sync** - All fields populated from ADO
- **Database migration** - Existing databases automatically upgraded

### Benefits
- Find work items by acceptance criteria keywords
- Search bugs by reproduction steps
- Filter by priority, story points, severity
- Track effort (estimates vs actuals)
- See complete workflow history
- Better AI tagging with more context

### Migration
Database automatically migrates on first run - no manual action needed.

## [1.2.1] - 2025-01-18

### Added
- **AI Tagging section in Sync tab** of the web dashboard
- Real-time display of items pending AI tagging
- One-click AI tagging button with configurable batch size
- New API endpoints:
  - `GET /api/stats/pending-tags` - Returns count of items needing tags
  - `POST /api/tag-pending` - Runs AI tagging on pending items
- Tagging progress shown in sync console with live updates

### Workflow
1. Sync from Azure DevOps (adds hierarchy tags automatically)
2. View pending tag count in dashboard
3. Run AI tagging to add semantic tags
4. Tags are stored in database permanently

## [1.2.0] - 2025-01-18

### Added
- Automatic hierarchy tagging during sync based on parent/child relationships
- **Orphan tag**: Automatically applied to User Stories, Tasks, and Bugs with no parent
- **Top-level tags**: Applied to Features and Epics with no parent (e.g., "top-level-feature", "top-level-epic")
- **Parent relationship tags**: "has-parent" tag for items with parents, "child-of-{type}" for specific parent types

### How It Works
- Tags are added **automatically during sync** when work items are fetched from Azure DevOps
- Hierarchy tags are preserved even if you run AI tagging later (they get merged)
- Items still flagged for AI tagging to get additional semantic tags

### Use Cases
- Search for orphans: `search_work_items` with `tags=["orphan"]`
- Find top-level features: `search_work_items` with `tags=["top-level-feature"]`
- Find items with parents: `search_work_items` with `tags=["has-parent"]`

## [1.1.1] - 2025-01-18

### Fixed
- URL encoding for project names with spaces (e.g., "Meds Management" now properly encoded as "Meds%20Management")
- ADO URLs now clickable in all applications

## [1.1.0] - 2025-01-18

### Added
- Parent/child relationship filtering in search
- New `parentId` parameter to search for children of a specific parent work item
- New `hasParent` boolean parameter to find orphan items (hasParent=false) or items with parents (hasParent=true)
- Parent and children information now included in `get_work_item` responses
- Helper functions `getWorkItemParent()` and `getWorkItemChildren()` for relationship queries

### Use Cases
- Find all orphan User Stories: `search_work_items` with `hasParent=false` and `workItemType="User Story"`
- Find children of an Epic: `search_work_items` with `parentId="1234567"`
- Find top-level Features: `search_work_items` with `hasParent=false` and `workItemType="Feature"`

## [1.0.3] - 2025-01-18

### Added
- Added `adoUrl` field to all work item responses
- Work items now return clickable Azure DevOps URLs alongside the ADO ID
- URLs are automatically constructed from org URL and project settings

## [1.0.2] - 2025-01-14

### Changed
- Removed all startup/progress messages to eliminate unnecessary warnings in Claude Desktop
- Dashboard Settings tab now read-only, displays current configuration from MCP config file
- Settings can only be changed through Claude Desktop config file

## [1.0.1] - 2025-01-14

### Fixed
- Fixed JSON-RPC protocol violation caused by console.log() statements writing to stdout
- Changed all console.log() calls to console.error() to ensure stdout is reserved exclusively for MCP protocol messages
- Resolves "Invalid JSON-RPC message" errors in Claude Desktop

## [1.0.0] - 2025-01-13

### Added
- Initial release of MGC ADO Tracker
- Core work item tracking with local SQLite database
- AI-powered tag generation for work items
- Azure DevOps API integration for creating and syncing work items
- Web dashboard at localhost:3738
- Search functionality with filters for type, state, area, iteration, and tags
- Background sync with configurable intervals
- Manual sync and historical data import
- Statistics dashboard with charts
- Database backup functionality
- MCP server integration for Claude Desktop
- Comprehensive README and documentation

### Features
- Create work items in Azure DevOps via Claude
- Search tracked items using natural language and filters
- Auto-generate tags based on work item content
- Sync work items from Azure DevOps
- View detailed work item information
- Track relationships between work items
- Export/backup database
- Settings management via dashboard

### Technical Details
- Built with Node.js and Express
- Uses sql.js for cross-platform database compatibility
- Azure DevOps Node API for ADO integration
- MCP SDK for Claude integration
- Vanilla JavaScript for dashboard (no frameworks)
- RESTful API design

## Roadmap

### [1.1.0] - Planned
- [ ] Bulk edit tags
- [ ] Custom tag categories
- [ ] Export search results to CSV/Excel
- [ ] Advanced filtering (date ranges, custom queries)
- [ ] Area path and iteration path suggestions
- [ ] Dark mode for dashboard
- [ ] Keyboard shortcuts in dashboard

### [1.2.0] - Planned
- [ ] Integration with Claude API for enhanced tagging
- [ ] Work item templates
- [ ] Saved searches
- [ ] Email notifications for sync errors
- [ ] Multi-project support
- [ ] Team collaboration features

### Future Ideas
- [ ] VS Code extension
- [ ] Slack integration
- [ ] Power BI connector
- [ ] Mobile-responsive dashboard
- [ ] AI-powered work item recommendations
- [ ] Automatic area path cleanup suggestions
