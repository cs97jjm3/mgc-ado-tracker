# Changelog

All notable changes to MGC ADO Tracker will be documented in this file.

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
