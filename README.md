# MGC ADO Tracker

🔐 **Secure Azure DevOps work item tracking with AI-powered tagging, role-based access control, and comprehensive analytics.**

## What It Does
 
MGC ADO Tracker solves a real problem: **finding work items in messy Azure DevOps projects**.

- 🔐 **Secure Authentication**: Role-based access with admin and user roles
- 📥 **Fast Sync**: Import work items from Azure DevOps to local database  
- 🏷️ **AI Tagging**: Generate intelligent tags from work item content
- 🔄 **AI Re-Tagging**: Refresh tags with improved quality or fix low-confidence tags
- 🔍 **Smart Search**: Find items by content, not just Azure's structure
- 📊 **Rich Analytics**: Team workload, velocity trends, and comprehensive statistics
- 🎯 **Project Filtering**: Filter all statistics by specific projects
- 🌐 **Web Dashboard**: Clean, secure interface with collapsible sections
- 👥 **User Management**: Multi-user support with admin controls
- 🤖 **Claude Integration**: Natural language search via Claude Desktop

**No more clicking through iterations and area paths hoping to find that authentication story you created 3 months ago.**

## Key Features

### 🔐 Security & Authentication

- **Session-Based Authentication**: Secure httpOnly cookies with configurable timeout
- **Role-Based Access Control**: Admin and User roles with different permissions
- **Password Hashing**: bcrypt with 10 salt rounds
- **User Management**: Admin panel for creating, editing, and managing users
- **Auto-Created Admin**: First admin user created from environment variables
- **Remember Me**: Optional 30-day session extension
- **Last Login Tracking**: Monitor user activity
- **Soft Deletes**: Users can be deactivated but data preserved

**Access Control:**
- **Search & Statistics**: Available to all authenticated users
- **Sync, Settings & Users**: Admin-only access
- **Password Changes**: Users can change their own password
- **User CRUD**: Admins only

### Search & Discovery

- **Smart Search**: Find work items by keywords, tags, or content
- **AI Tagging**: Automatically generates meaningful tags (authentication, security, mobile, etc.)
- **Hierarchy Tracking**: See parent-child relationships (Epics → Features → Stories)
- **Tag Confidence Scores**: See how confident the AI is about each tag

### AI Re-Tagging

- **5 Re-tagging Modes**:
  - 🔄 Re-tag Everything (complete refresh)
  - ⚠️ Fix Poor Quality Tags (below confidence threshold)
  - 📅 Re-tag by Date Range (specific time period)
  - 📁 Re-tag One Project (focus on specific project)
  - 🏷️ Tag Missing Items (untagged only)
- **Safe Operations**: Automatic tag backup before re-tagging
- **Progress Tracking**: Real-time progress bar with item counts
- **Cancellable**: Stop re-tagging after current batch
- **Batch Processing**: Configure batch size (1-100 items)
- **Admin-Only Access**: Protected re-tagging operations

### Analytics & Statistics

**Global Stats**:
- Total items, tags, database size, last sync time

**Team & Workload**:
- Unassigned items count (items needing owners)
- Recently modified items (last 7 days)
- Average time to close (from creation to closure)
- Top assignees with open items (who has the most work)

**Velocity Tracking**:
- Items closed per week (last 8 weeks)
- Week-end dates for each bar
- Color-coded trend visualization:
  - 🔴 Red: 0-33% of max (low velocity)
  - 🟡 Yellow: 34-66% of max (medium velocity)
  - 🟢 Green: 67-100% of max (high velocity)
- Easy spot velocity drops or improvements

**Per-Project Breakdown**:
- Total items, Epics, Features, Orphans per project
- Orphan percentage with color-coding

**Work Item Health**:
- Tagging progress, completion rates
- Items without descriptions
- Stale items (30/60/90 days without updates)

**Project Filtering**:
- Filter ALL statistics by project
- Works with single or multiple projects
- Positioned between "Statistics by Project" and "Team & Workload"
- Clear visual indicator with blue border

### Dashboard Features

- **Secure Login**: Email/password authentication with role-based access
- **Collapsible Sections**: Sync page sections can expand/collapse for cleaner navigation
- **Web Dashboard**: Clean interface at `localhost:3738`
- **MCP Integration**: Works with Claude Desktop for natural language search
- **Export**: Download as CSV (all users)
- **Database Management**: Backup, shrink, optimize (admin only)
- **User Management**: Create, edit, delete users (admin only)
- **Persistent State**: Remembers which sections you've expanded/collapsed

## Installation

### Prerequisites

- Node.js 18+
- Azure DevOps account with Personal Access Token
- Claude Desktop (for MCP integration)

### Quick Start

1. **Clone repository**
```bash
git clone https://github.com/cs97jjm3/mgc-ado-tracker.git
cd mgc-ado-tracker
npm install
```

2. **Create Azure DevOps PAT**
   - Go to Azure DevOps → Profile → Personal access tokens
   - Create new token with Work Items (Read & Write) scope
   - Copy the token

3. **Configure Claude Desktop**

Edit your config file:
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mgc-ado-tracker": {
      "command": "node",
      "args": ["C:\\Users\\YourName\\path\\to\\mgc-ado-tracker\\src\\index.js"],
      "env": {
        "ADO_ORG_URL": "https://dev.azure.com/your-organization",
        "ADO_PAT": "your-personal-access-token",
        "ADO_PROJECT": "YourProjectName",
        "DASHBOARD_PORT": "3738"
      }
    }
  }
}
```

4. **Restart Claude Desktop**

5. **Access Dashboard**: http://localhost:3738

## Authentication Setup

### First-Time Setup

On first run, a default admin account is created automatically:

**Default Credentials:**
- Username: `admin`
- Password: `admin123`

⚠️ **IMPORTANT**: Change this password immediately after first login!

### Login Process

1. Visit http://localhost:3738
2. Enter default credentials (admin / admin123)
3. Click "Sign In"
4. **Go to Settings tab → Change Password** (recommended)
5. Optional: Check "Remember me" to extend session to 30 days (default: 24 hours)

### User Management (Admin Only)

Admins can manage users via the **👥 Users** tab (only visible to admins):

**Add Users:**
1. Click "➕ Add User"
2. Enter username, password (min 8 characters), display name, and role
3. Choose role: 
   - **User**: Can search, view statistics, export data
   - **Admin**: Full access including sync, settings, user management
4. Click Save

**Edit Users:**
- Click Edit button on user row
- Update username, display name, or role
- Leave password blank to keep current password
- Cannot edit your own account

**Delete Users:**
- Click Delete button (soft delete - user is deactivated)
- Deleted users cannot login but data is preserved
- Cannot delete your own account

**Change Passwords:**
- Users can change their own password in Settings tab
- Admins can reset passwords for any user

### Security Features

- **Password Hashing**: bcrypt with 10 salt rounds
- **Session-Based Auth**: express-session with httpOnly cookies
- **Role-Based Access**: Admin vs User permissions enforced server-side
- **Password Requirements**: Minimum 8 characters
- **Session Timeout**: Configurable via `SESSION_MAX_AGE` (default: 24 hours)
- **Soft Deletes**: Users can be restored from database if needed
- **Last Login Tracking**: Monitor user activity
- **Remember Me**: Extends session to 30 days
- **Secure Cookies**: httpOnly flag prevents XSS attacks

### Access Control Matrix

| Feature | User | Admin |
|---------|------|-------|
| Search Work Items | ✅ | ✅ |
| View Statistics | ✅ | ✅ |
| Export CSV | ✅ | ✅ |
| Sync Data | ❌ | ✅ |
| AI Tagging | ❌ | ✅ |
| AI Re-Tagging | ❌ | ✅ |
| View Settings | ❌ | ✅ |
| User Management | ❌ | ✅ |
| Database Backup | ❌ | ✅ |

### Configuration Options

Add to Claude Desktop config (optional):

```json
{
  "env": {
    "SESSION_SECRET": "your-random-secret-here",
    "SESSION_MAX_AGE": "86400000"
  }
}
```

**Environment Variables:**
- `SESSION_SECRET`: Secret key for session encryption (auto-generated if not set)
- `SESSION_MAX_AGE`: Session timeout in milliseconds (default: 86400000 = 24 hours)

### Troubleshooting Authentication

**Cannot Login:**
- Use default credentials: admin / admin123
- Check browser console for errors
- Clear browser cookies and cache
- Restart Claude Desktop to reload server

**Session Expires Too Quickly:**
- Increase `SESSION_MAX_AGE` (in milliseconds)
- Use "Remember me" option at login
- Default: 24 hours (86400000ms)
- "Remember me": 30 days (2592000000ms)

**Users Tab Not Visible:**
- Only admins can see the Users tab
- Login as admin to access user management
- First user (admin) is always admin role

**Forgot Admin Password:**
- Stop MCP server
- Delete database: `~/.ado-tracker/database.db`
- Restart Claude Desktop (admin account recreated)
- **Warning**: This deletes all data including work items

## Usage

### Searching via Claude Desktop

```
You: "Did we create a story about medication reminders?"
Claude: [Searches and finds instantly]

You: "Show me all authentication bugs"
Claude: [Returns filtered results]

You: "Find items assigned to John that are stale"
Claude: [Searches with filters]
```

### Searching via Dashboard

1. Login at http://localhost:3738
2. Go to Search tab
3. Enter keywords or select filters (project, type, state, tags)
4. Click Search
5. Click results to see details
6. Click 🔗 to open in Azure DevOps

### Understanding Sync Options (Admin Only)

**Start Sync** (Quick):
- Respects "From Date" and "Max Items" settings
- Use for regular updates
- Fast incremental sync

**Import Historical Data** (Complete):
- Ignores date and item limits
- Imports ALL work items from project
- Slower but comprehensive
- Use once for initial setup

### AI Re-Tagging (Admin Only)

**When to re-tag:**
- Tags have low confidence scores
- You've improved your tagging prompts
- You want to standardize tags across projects
- Initial tagging was done with an older AI model

**How to re-tag:**

1. Go to Sync tab → Expand "AI Re-Tagging" section
2. Select mode:
   - **Re-tag Everything**: Complete refresh of all tags
   - **Fix Poor Quality Tags**: Only items below X% confidence
   - **Re-tag by Date Range**: Items from specific time period
   - **Re-tag One Project**: Focus on specific project
   - **Tag Missing Items**: Items with no AI tags
3. Click "📊 Estimate Count" to see how many items
4. Configure batch size (default: 50)
5. Click "🚀 Start Re-Tagging"
6. Watch progress bar
7. Cancel anytime (stops after current batch)

**Safety Features:**
- Automatic tag backup before re-tagging
- Hierarchy tags preserved (orphan, has-parent, top-level-*)
- Error handling with retry logic
- Database saves after each batch
- Progress polling every 1 second

### Viewing Statistics

1. Go to Statistics tab
2. **Filter by Project**: Use dropdown (positioned between project stats and team workload)
3. View sections:
   - **Global Stats**: Overview cards
   - **Statistics by Project**: Per-project breakdown
   - **Project Filter**: 📁 Blue-bordered filter dropdown
   - **Team & Workload**: Unassigned, recent activity, closure times
   - **Top Assignees**: See who has the most open items (top 10)
   - **Velocity Trend**: 8-week closure trend with dates and color coding
   - **Charts**: By Type, State, Project, Tags

**Understanding the Stats:**

- **Unassigned Items**: Open items without owners - action needed
- **Recently Modified**: Activity in last 7 days
- **Avg Time to Close**: How long items take to complete
- **Top Assignees**: Team workload distribution (displays name without email)
- **Velocity Trend**: 
  - Week labels with end dates (e.g., "Week 1 - Ending 27 Jan")
  - 🔴 Red bars = Low velocity (0-33% of max)
  - 🟡 Yellow bars = Medium velocity (34-66%)
  - 🟢 Green bars = High velocity (67-100%)

### Collapsible Sections (Sync Tab - Admin Only)

The Sync tab has 5 collapsible sections for cleaner navigation:

**Default States:**
- ▼ **Manual Sync** - Open (most frequently used)
- ▼ **AI Tagging** - Open (often needed after sync)
- ▶ **AI Re-Tagging** - Collapsed (less frequently used)
- ▶ **Sync Status** - Collapsed (check when needed)
- ▶ **Sync History** - Collapsed (reference only)

**Features:**
- Click section header to expand/collapse
- Remembers your preferences (stored in browser localStorage)
- Smooth animations
- Less scrolling, better focus

### Syncing (Admin Only)

**Manual Sync:**
- Sync tab → Select project → Start Sync or Import Historical Data
- Start Sync: Takes ~30 seconds for 1000 items (incremental)
- Import Historical: Takes longer (complete import of all items)
- Syncs all work item types except: Test Cases, Test Suites, Shared Parameters, Test Plans, Shared Steps

**AI Tagging:**
- After sync, admin can tag items via dashboard AI Tagging panel
- Or use Claude chat (if admin MCP session): "Tag my pending work items"
- Processes items in batches
- Background processing available

### Exporting

Settings tab → Export to CSV (available to all users)

## MCP Tools

Available when using with Claude Desktop (requires authentication session):

### Core Tools
- `create_work_item` - Create work item in ADO (admin only)
- `search_work_items` - Search by keywords/tags/filters
- `get_work_item` - Get item details
- `list_tags` - Show all tags with counts
- `launch_dashboard` - Get dashboard URL

### Sync Tools (Admin Only)
- `sync_ado_work_items` - Import from ADO
- `get_sync_status` - Check sync status
- `cleanup_excluded_work_items` - Remove test items

### Tagging Tools (Admin Only)
- `tag_pending_work_items` - Generate AI tags for batch
- `tag_all_items` - Force re-tag everything
- `start_background_tagging` - Auto-tag in background
- `stop_background_tagging` - Stop background tagging
- `get_tagging_status` - Check tagging progress

## Database

**Location**: `~/.ado-tracker/database.db`  
**Backups**: `~/.ado-tracker/backups/` (keeps last 7)

### Database Schema

**Main Tables:**
- `work_items`: All work items with full metadata (35+ fields)
- `work_item_links`: Parent-child relationships
- `tags`: Tag usage statistics
- `sync_logs`: Sync history
- `users`: User accounts with authentication
- `sessions`: User sessions

**Re-Tagging Columns:**
- `tags_backup`: Backup of tags before re-tagging
- `confidence_scores_backup`: Backup of confidence scores
- `backup_timestamp`: When backup was created
- `last_retagged_at`: Last re-tag timestamp

**User Table Columns:**
- `id`: Primary key
- `email`: Username (unique)
- `password_hash`: bcrypt hashed password
- `display_name`: Full name or display name
- `role`: admin or user
- `is_active`: 1 = active, 0 = deleted
- `last_login`: Last login timestamp
- `created_at`: Account creation timestamp

### Database Features

- Stores all work items with full metadata
- Tracks parent-child relationships via links table
- Maintains sync history and tagging status
- Auto-reloads after sync to ensure fresh data
- Supports VACUUM to reclaim space
- Automatic tag backups before re-tagging
- User authentication and session management
- Role-based access control

### Statistics Available

**Hierarchy Stats:**
- Epics, Features count
- Orphan items (no parent)
- Items with children
- Average children per parent
- Maximum hierarchy depth

**Team & Workload Stats:**
- Top assignees with open items (top 10, cleaned names)
- Unassigned items count
- Recently modified items (7 days)
- Average time to close (days)

**Velocity Stats:**
- Items closed per week (last 8 weeks)
- Week-end dates displayed
- Trend analysis with color coding (red/yellow/green)

**Health Stats:**
- Tagging progress percentage
- Items without descriptions
- Completion rate
- Stale items (30/60/90 days)

**Activity Stats:**
- Items created this week/month
- Items closed this week/month
- Average age of open items
- Oldest open item

## Project Structure

```
mgc-ado-tracker/
├── src/
│   ├── index.js              # MCP server
│   ├── auth/
│   │   └── auth.js          # Authentication module
│   ├── database/
│   │   ├── db.js            # Database management
│   │   └── workItems.js     # Work item queries
│   ├── api/                  # Azure DevOps API
│   ├── sync/                 # Sync service
│   ├── retag/               # Re-tagging service
│   ├── dashboard/            # Web server + API endpoints
│   └── utils/                # AI tagging
├── public/                   # Dashboard UI
│   ├── index.html           # Main dashboard
│   ├── login.html           # Login page
│   ├── css/
│   │   └── styles.css       # Complete styling
│   ├── js/
│   │   └── app.js           # Frontend logic
│   ├── logo.png
│   ├── favicon.ico
│   └── favicon.png
├── package.json
└── README.md                # This file
```

## Dashboard Endpoints

### Authentication API
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout and destroy session
- `GET /api/auth/me` - Get current user info

### User Management API (Admin Only)
- `GET /api/users` - List all users
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete (deactivate) user
- `POST /api/users/:id/password` - Change password

### Statistics API
- `GET /api/stats/database` - Database stats
- `GET /api/stats/work-items` - Work item stats (includes team & velocity)
- `GET /api/stats/by-project` - Per-project stats
- `GET /api/stats/pending-tags` - Items needing tags

### Re-Tagging API (Admin Only)
- `POST /api/retag/estimate` - Estimate item count for re-tag mode
- `POST /api/retag/execute` - Start re-tagging operation
- `GET /api/retag/progress` - Get real-time progress
- `POST /api/retag/cancel` - Cancel running operation

### Search & Work Items
- `GET /api/work-items/search` - Search work items
- `GET /api/work-items/:id` - Get work item details
- `GET /api/tags` - Get all tags
- `GET /api/projects` - Get all projects (admin only)

### Sync (Admin Only)
- `POST /api/sync` - Manual sync (quick)
- `POST /api/import` - Import historical data (complete)
- `GET /api/sync/status` - Sync status
- `GET /api/sync/history` - Sync history
- `GET /api/sync/progress` - Real-time sync progress

### Database (Admin Only)
- `POST /api/backup` - Create backup
- `POST /api/database/shrink` - Vacuum database
- `GET /api/export/csv` - Export to CSV (all users)

### Settings (Admin Only)
- `GET /api/settings` - Get configuration

## Configuration Options

Add to your Claude Desktop config:

```json
{
  "env": {
    "ADO_ORG_URL": "https://dev.azure.com/your-org",
    "ADO_PAT": "your-token",
    "ADO_PROJECT": "ProjectName",
    "DASHBOARD_PORT": "3738",
    
    // Optional:
    "SESSION_SECRET": "your-random-secret",
    "SESSION_MAX_AGE": "86400000",
    "SYNC_ENABLED": "false",
    "SYNC_INTERVAL_MINUTES": "60",
    "AUTO_TAG_NEW_ITEMS": "true",
    "TAG_CONFIDENCE_THRESHOLD": "0.8"
  }
}
```

## Troubleshooting

**"Azure DevOps not initialized"**
- Check PAT token is valid (not expired)
- Verify organization URL format
- Ensure PAT has Work Items (Read & Write) permissions

**"Port 3738 is busy"**
- Change `DASHBOARD_PORT` in config to another port
- Or stop other service using 3738

**Cannot access Sync/Settings tabs**
- These tabs require admin role
- Login as admin (default: admin / admin123)
- Regular users only see Search and Statistics tabs

**Sync not working**
- Must be logged in as admin
- Verify exact project name (case-sensitive)
- Check PAT permissions include project
- Review sync history in dashboard for specific errors

**Re-tagging shows 0 items**
- Must be admin to access re-tagging
- Check if items are already tagged
- Verify project name if using project filter
- Try "📊 Estimate Count" to see why count is 0

**Statistics not updating after sync**
- Click "Refresh Stats" button in Settings tab
- Or reload the page
- Check if sync completed successfully

**Project filter not showing projects**
- Ensure you've synced at least one project
- Check if project_name field is populated
- Refresh the Statistics tab

**Batch size input not visible**
- Clear browser cache and reload
- Check if using latest version of styles.css
- Input should have white background with border

**Sections won't collapse/expand**
- Check if JavaScript loaded correctly (F12 console)
- Try clearing localStorage: `localStorage.clear()`
- Reload page

**Session expired / kicked out**
- Session timeout reached (default: 24 hours)
- Use "Remember me" for 30-day sessions
- Check `SESSION_MAX_AGE` configuration

## Performance Tips

- **Sync in batches**: Use `maxItems` parameter for large projects
- **Background tagging**: Enable for automatic tagging (admin only)
- **Shrink database**: Run periodically to reclaim space (admin only)
- **Export regularly**: Keep CSV backups of important data
- **Re-tag selectively**: Use confidence threshold or project filter instead of "all items"
- **Collapse unused sections**: Keep Sync tab organized by collapsing sections you don't need
- **Use appropriate roles**: Give users "user" role if they only need search/stats access

## Technologies

- **Backend**: Node.js + Express
- **Database**: sql.js (SQLite in-memory with persistent storage)
- **Azure DevOps**: azure-devops-node-api
- **AI**: Anthropic SDK (Claude Sonnet 4)
- **MCP**: @modelcontextprotocol/sdk
- **Authentication**: express-session + bcrypt
- **Frontend**: Vanilla JavaScript, CSS Grid/Flexbox

## Changelog

### v2.3.0 (Latest - January 27, 2026)
- 🔐 **Comprehensive Authentication System**:
  - Session-based authentication with role-based access control
  - Default admin account (admin / admin123)
  - User management panel with create/edit/delete (admin only)
  - Password hashing with bcrypt (10 salt rounds)
  - Login page with "Remember me" option
  - Session timeout configuration (default: 24 hours)
  - httpOnly secure cookies
  - Soft delete for user accounts
  - Last login tracking
  - Password requirements (min 8 characters)
- 🔒 **Protected Routes**:
  - Sync operations (admin only)
  - AI Tagging & Re-Tagging (admin only)
  - Settings & Configuration (admin only)
  - User Management (admin only)
  - Database Backup (admin only)
  - Search & Statistics (all authenticated users)
  - Export CSV (all authenticated users)
- 🎨 **UI Improvements**:
  - Styled login page with branding
  - User dropdown in header with logout
  - Role-based tab visibility
  - Users tab (admin only)
  - Professional look & feel

### v2.2.0
- 🎨 **UX Improvements**: Complete redesign of Sync page sections
  - Clean card-based layout for re-tagging options
  - Plain English labels ("Fix Poor Quality Tags" vs "confidence threshold")
  - Comprehensive help text and explanations
  - Visual hierarchy with icons and descriptions
  - Better warning boxes with bullet points
- 📁 **Collapsible Sections**: All Sync page sections now collapse/expand
  - Remembers state in localStorage
  - Smooth animations
  - Better focus and less scrolling
- 🐛 **Bug Fixes**: 
  - Batch size input now visible (white background, proper styling)
  - Project filter positioned correctly (between project stats and team workload)
  - Better CSS specificity for form inputs
- 📅 **Velocity Dates**: Week-end dates now shown on velocity chart bars

### v2.0.0 
- ✨ AI Re-Tagging with 5 modes
- ✨ Team & Workload statistics
- ✨ Velocity trend tracking (8 weeks)
- ✨ Top assignees chart
- ✨ Project filtering for all statistics
- ✨ Recently modified tracking
- ✨ Average time to close metric
- 🐛 Fixed project-aware orphan counting
- 🎨 Improved dashboard UI with filter bar
- 📊 Enhanced statistics API endpoints

### v1.0.0
- Initial release
- Azure DevOps sync
- AI tagging
- Search functionality
- Web dashboard
- MCP integration

## About

Built by James Martin, Business Analyst at The Access Group.

**Contact**: james.martin@theaccessgroup.com  
**GitHub**: https://github.com/cs97jjm3/mgc-ado-tracker  
**Gumroad Guide**: [The Business Analyst's Guide to AI-Assisted Tool Development](https://gumroad.com)

Part of the MGC tool suite for Azure DevOps and business analysis workflows.

**Other MGC Tools:**
- MGC Calendar - Event management with LinkedIn posting
- MGC Web Page Analyzer - Website analysis with login support
- UK Healthcare Research MCP - Regulatory data integration
- Moby Accessibility Checker - WCAG compliance testing

## Contributing

Issues and pull requests welcome!

Please ensure:
- Code follows existing style
- New features include documentation
- Breaking changes are clearly marked
- Tests pass (when test suite is added)

## License

MIT License - See LICENSE file for details

---

**Stop losing track of your work items. Start using MGC ADO Tracker today.**

**New in v2.3:** Comprehensive authentication system with role-based access control. Secure your Azure DevOps data with session-based authentication, user management, and admin-only operations. 🔐🚀
