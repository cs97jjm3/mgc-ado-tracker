# Changelog

All notable changes to MGC ADO Tracker will be documented in this file.

## [2.3.0] - 2026-02-01

### Added
- **Comprehensive Authentication System**:
  - Session-based authentication with role-based access control
  - User management interface for admins
  - Login page with "Remember me" functionality
  - Default admin account (username: admin, password: admin123)
  - Password hashing with bcrypt (10 salt rounds)
  - Session timeout configuration (default: 24 hours, "Remember me": 30 days)
  - httpOnly secure cookies for XSS protection
  - Last login tracking for all users
  - Soft delete for user accounts (data preserved)
- **Role-Based Access Control**:
  - Admin role: Full access to all features
  - User role: Search, statistics, and export only
  - Protected routes with middleware enforcement
  - Server-side permission validation
- **User Management (Admin Only)**:
  - Create new users with email, password, display name, and role
  - Edit user details (username, display name, role, active status)
  - Delete (deactivate) users while preserving data
  - Password change interface (users can change own, admins can reset any)
  - Password requirements (minimum 8 characters)
  - Cannot delete or edit own account
  - View user list with last login timestamps
- **Protected Features**:
  - Sync operations: Admin only
  - AI Tagging & Re-Tagging: Admin only
  - Settings & Configuration: Admin only
  - Database backup & management: Admin only
  - User Management: Admin only
  - Search & Statistics: All authenticated users
  - CSV Export: All authenticated users

### Changed
- **UI Updates**:
  - Professional login page with MGC branding
  - User dropdown in header with logout button
  - Users tab (only visible to admins)
  - Role-based tab visibility (Sync, Settings, Users)
  - Improved security messaging throughout
- **Database Schema**:
  - New `users` table with authentication fields
  - New `sessions` table for session management
  - User tracking on all operations
- **API Endpoints**:
  - All routes now require authentication
  - Role-based endpoint protection
  - Proper 401/403 responses for unauthorized access

### Security
- Password hashing with bcrypt and 10 salt rounds
- Session-based authentication with express-session
- httpOnly cookies prevent XSS attacks
- CSRF protection via session management
- Secure password reset workflow (admin-initiated)
- Auto-logout on session expiration
- No password exposure in logs or responses

### Fixed
- User creation: Fixed parameter mismatch between API and auth module
- Password change: Fixed to allow admin password resets without old password
- Session persistence across page reloads
- Proper error handling for authentication failures

## [2.2.0] - 2026-01-27

### Added
- **Collapsible Sections**: All Sync page sections now expand/collapse with state persistence
  - Manual Sync: Open by default
  - AI Tagging: Open by default
  - AI Re-Tagging: Collapsed by default
  - Sync Status: Collapsed by default
  - Sync History: Collapsed by default
- **Velocity Week Dates**: Velocity chart now shows week end dates (e.g., "Ending 27 Jan")
- **Section State Memory**: Collapse preferences saved to localStorage and restored on reload

### Changed
- **Complete UX Redesign** of Sync page:
  - Re-tagging options now use card-based layout with icons
  - Plain English labels: "Fix Poor Quality Tags" instead of "confidence threshold"
  - Each option has title + description for clarity
  - Better visual hierarchy with proper spacing
  - Help boxes with bullet points explaining features
- **Improved Warning Boxes**:
  - Clear bullet points with timing estimates
  - Better contrast (cream background, orange border)
  - Larger emoji icons for visibility
- **Better Explanations**:
  - "What is Re-Tagging?" blue info box added
  - Sync buttons now have help text explaining difference
  - Batch size fields have helpful context text

### Fixed
- **Batch Size Input Visibility**: White background with proper border, always visible
- **Project Filter Position**: Moved to correct location (between project stats and team workload)
- **CSS Specificity**: Fixed `.batch-size-control input` color conflict
- **Text Contrast**: All text now has proper contrast ratios (WCAG AA compliant)
- **Hover States**: Added proper hover effects to collapsible section headers

## [2.0.0] - 2026-01-26

### Added
- **AI Re-Tagging System**: 5 modes to refresh tag quality
  - Re-tag Everything (complete refresh)
  - Fix Poor Quality Tags (below confidence threshold)
  - Re-tag by Date Range (specific time period)
  - Re-tag One Project (focus on one project)
  - Tag Missing Items (untagged only)
- **Re-Tagging Safety Features**:
  - Automatic tag backup before re-tagging
  - Hierarchy tags preserved (orphan, has-parent, top-level-*)
  - Real-time progress tracking with cancellation
  - Error handling with retry logic
  - Database saves after each batch
- **Team & Workload Statistics**:
  - Unassigned items count
  - Recently modified items (last 7 days)
  - Average time to close (days)
  - Top 10 assignees with open items (cleaned names without email)
- **Velocity Trend Tracking**:
  - Items closed per week (last 8 weeks)
  - Color-coded trend visualization (red/yellow/green)
  - Red: 0-33% of max (low velocity)
  - Yellow: 34-66% of max (medium velocity)
  - Green: 67-100% of max (high velocity)
- **Project Filtering**: Filter ALL statistics by project
  - Works with single or multiple projects
  - Updates all stats, charts, and metrics instantly
  - Clear visual indicator with blue border and arrow
- **Database Schema Enhancements**:
  - `tags_backup` column for tag backup
  - `confidence_scores_backup` column for confidence backup
  - `backup_timestamp` for tracking backup time
  - `last_retagged_at` for tracking re-tag operations

### Changed
- **Statistics API**: Now returns team & workload data
- **Orphan Counting**: Now project-aware and more accurate
- **Sync Help Text**: Added explanation of Start Sync vs Import Historical Data
- **Project Filter UI**: Positioned between project stats and team workload sections

### Fixed
- Project-aware orphan counting bug
- Statistics not updating after project filter change
- Velocity chart data calculation

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
