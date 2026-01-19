# Changelog

All notable changes to MGC ADO Tracker will be documented in this file.

## [1.3.5] - 2026-01-19

### Added
- Professional dashboard redesign with Microsoft Fluent-inspired styling
- Improved UI with better spacing, typography, and color scheme
- Enhanced stat cards with cleaner layout
- Better form controls and button styles
- Responsive design improvements

### Fixed
- Database initialization issues with missing sync_log table
- Migration system now properly creates missing tables
- Better error handling for database operations

## [1.3.0] - 2026-01-18

### Added
- 21 new database fields for enhanced work item tracking
- Acceptance criteria field
- Reproduction steps field
- System information field
- Priority, severity, story points tracking
- Business value and risk assessment fields
- Build tracking (found in, integration build)
- Workflow tracking (resolved by/date, closed by/date, activated by/date)
- State reason tracking
- Effort tracking (original estimate, remaining work, completed work)
- Native ADO tags field

### Changed
- Improved search capabilities with new fields
- Better work item detail display
- Enhanced filtering options

## [1.2.1] - 2026-01-15

### Added
- Background tagging system for processing large batches
- Tag all items functionality
- Improved tagging progress tracking

### Fixed
- Performance improvements for large datasets
- Better batch processing

## [1.2.0] - 2026-01-12

### Added
- Web dashboard at localhost:3738
- Statistics tab with charts
- Manual sync interface
- AI tagging controls
- Export to CSV/Excel

### Changed
- Split sync and tagging into separate operations
- Improved MCP tool organization

## [1.1.0] - 2026-01-08

### Added
- AI-powered tagging using Claude
- Confidence scores for tags
- Batch processing for efficient tagging
- Tag management system

## [1.0.0] - 2026-01-05

### Added
- Initial release
- Basic sync from Azure DevOps
- SQLite database storage
- MCP server implementation
- Search functionality
- Basic dashboard
