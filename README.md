# MGC ADO Tracker

**Track Azure DevOps work items with AI-powered tagging and intelligent search**

Built by a Business Analyst who's lived through the chaos of poorly organized Azure DevOps projects.

## What It Does

MGC ADO Tracker solves a real problem: **finding work items in messy Azure DevOps projects**.

When you create or import work items, the tracker:
- 📝 Logs them to a local SQLite database
- 🏷️ Auto-generates intelligent tags using AI analysis
- 🔍 Makes them searchable by content, not just Azure's structure
- 🔄 Syncs with Azure DevOps to stay current
- 📊 Provides a clean web dashboard for searching and analysis

**No more clicking through iterations and area paths hoping to find that authentication story you created 3 months ago.**

## Features

### Core Capabilities
- **Smart Search**: Find work items by keywords, tags, or content - regardless of where they live in Azure
- **AI Tagging**: Automatically generates meaningful tags from work item titles and descriptions
- **Local Tracking**: Fast SQLite database with your own organizational structure
- **Azure Sync**: Background sync keeps your local database current
- **Web Dashboard**: Clean interface at `localhost:3738`
- **MCP Integration**: Works seamlessly with Claude Desktop for natural language search
- **Export**: Download as CSV or Excel for analysis in spreadsheets

### AI-Generated Tags
When a work item is created or imported, the tracker analyzes it and generates tags like:
- `authentication`, `security`, `payment`, `mobile`, `api`, `testing`, `bug`
- Area-based tags: `area-security`, `area-mobile`
- Iteration-based tags: `iteration-sprint-23`

Each tag gets a confidence score so you know which are most relevant.

### Dashboard Features
- **Search Tab**: Quick search with filters for type, state, area, iteration, tags
- **Statistics Tab**: Visual charts showing work items by type, state, project, and top tags
- **Sync Tab**: Manual sync with real-time console showing progress, import historical data, view sync history
- **Settings Tab**: Database management (backup, shrink, export), configuration display
- **Help Button**: Floating help button (?) with quick tips and instructions

### Claude Desktop Integration
Ask natural language questions in Claude chat:
- "Did we create a story about [topic]?" - Searches instantly
- "Show me all authentication bugs" - Filters by tags and type  
- "What are my top 5 most used tags?" - Analyzes your data
- "That thing about the side menu" - Finds it without exact titles

**No need to remember iterations, area paths, or exact work item titles!**

## Installation

### Prerequisites
- **Node.js 18+** ([Download](https://nodejs.org/))
- **Azure DevOps account** with Personal Access Token (PAT)
- **Claude Desktop** ([Download](https://claude.ai/download)) - for MCP integration

### Step 1: Clone Repository

```bash
git clone https://github.com/yourusername/mgc-ado-tracker.git
cd mgc-ado-tracker
```

### Step 2: Install Dependencies

```bash
npm install
```

This installs:
- `express` - Web server
- `sql.js` - SQLite database
- `azure-devops-node-api` - Azure DevOps API client
- `@modelcontextprotocol/sdk` - MCP server
- `@anthropic-ai/sdk` - AI tagging (optional)

### Step 3: Create Azure DevOps Personal Access Token

1. Go to Azure DevOps: `https://dev.azure.com/{your-organization}`
2. Click your profile picture → **Personal access tokens**
3. Click **+ New Token**
4. Configure:
   - **Name**: MGC ADO Tracker
   - **Expiration**: Custom (recommend 1 year)
   - **Scopes**: 
     - ✅ Work Items: **Read & Write**
     - ✅ Project and Team: **Read**
5. Click **Create**
6. **IMPORTANT**: Copy the token immediately (you can't see it again!)

### Step 4: Configure Claude Desktop

Edit your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
**Linux**: `~/.config/Claude/claude_desktop_config.json`

Add this configuration:

```json
{
  "mcpServers": {
    "mgc-ado-tracker": {
      "command": "node",
      "args": ["/FULL/PATH/TO/mgc-ado-tracker/src/index.js"],
      "env": {
        "ADO_ORG_URL": "https://dev.azure.com/your-organization",
        "ADO_PAT": "your-personal-access-token-here",
        "ADO_PROJECT": "YourDefaultProjectName",
        "DASHBOARD_PORT": "3738",
        "SYNC_ENABLED": "false",
        "SYNC_INTERVAL_MINUTES": "60",
        "AUTO_TAG_NEW_ITEMS": "true",
        "TAG_CONFIDENCE_THRESHOLD": "0.7"
      }
    }
  }
}
```

**Configuration Options:**
- `ADO_ORG_URL` - Your Azure DevOps organization URL (required)
- `ADO_PAT` - Personal Access Token from Step 3 (required)
- `ADO_PROJECT` - Default project name (required for sync)
- `DASHBOARD_PORT` - Web dashboard port (default: 3738)
- `SYNC_ENABLED` - Enable automatic background sync (true/false)
- `SYNC_INTERVAL_MINUTES` - How often to sync (default: 60)
- `AUTO_TAG_NEW_ITEMS` - Generate AI tags on sync (default: true)
- `TAG_CONFIDENCE_THRESHOLD` - Minimum tag confidence 0-1 (default: 0.7)

**Example paths:**
- Windows: `C:\\Users\\YourName\\Documents\\GitHub\\mgc-ado-tracker\\src\\index.js`
- macOS/Linux: `/Users/YourName/Projects/mgc-ado-tracker/src/index.js`

### Step 5: Restart Claude Desktop

1. Quit Claude Desktop completely
2. Reopen Claude Desktop
3. Look for 🔨 icon next to the message input - this confirms MCP is connected

### Step 6: Open Dashboard

Open your browser and go to:
```
http://localhost:3738
```

You should see the MGC ADO Tracker dashboard!

### Step 7: Import Work Items

1. Click the **Sync** tab
2. Select your project from the dropdown
3. Click **Start Sync** to import work items
4. Watch the real-time console show progress
5. Wait for sync to complete

**First sync with 1000 items takes ~2-5 minutes**

## Usage

### Searching via Claude Desktop Chat

The real power is in Claude Desktop chat:

```
You: "Did we create a story about medication reminders?"
Claude: [Searches and finds the story instantly]

You: "Show me all authentication bugs"
Claude: [Returns filtered results with tags]

You: "That thing about the side menu"
Claude: [Finds: US-01: APOC Mobile: Dynamic Side Menu...]
```

### Searching via Dashboard

1. Go to **Search** tab
2. Enter keywords or select filters
3. Click **Search**
4. Click any result to see full details
5. Click the 🔗 link to open in Azure DevOps

### Syncing Work Items

**Manual Sync:**
1. Go to **Sync** tab
2. Select project
3. Optionally set "From Date" to sync only recent changes
4. Click **Start Sync**
5. Watch real-time progress in console

**Automatic Sync:**
Set `SYNC_ENABLED: "true"` in config to sync automatically every hour (or custom interval).

### Exporting Data

1. Go to **Settings** tab
2. Click **Export to CSV** or **Export to Excel**
3. File downloads immediately
4. Open in Excel, Google Sheets, etc. for analysis

### Database Management

**Backup Database:**
- Settings tab → **Backup Database**
- Creates backup in `~/.ado-tracker/backups/`
- Keeps last 7 backups automatically

**Shrink Database:**
- Settings tab → **Shrink Database**
- Reclaims unused space after deletions
- Shows space saved

**Database Location:**  
`~/.ado-tracker/database.db`

## MCP Tools

Available tools when using with Claude Desktop:

- `create_work_item` - Create work item in ADO and track locally
- `search_work_items` - Search tracked items by keywords/tags/filters
- `get_work_item` - Get detailed info about a specific item
- `sync_ado` - Manually trigger sync with Azure DevOps
- `get_sync_status` - Check sync status and last sync time
- `list_tags` - List all available tags with usage counts
- `launch_dashboard` - Get dashboard URL

### Example MCP Usage

```
You: "Search for all mobile features"
Claude: [Calls search_work_items with tags: ["mobile", "feature"]]

You: "What's work item #1841957?"
Claude: [Calls get_work_item with adoId: "1841957"]]

You: "List my top tags"
Claude: [Calls list_tags and shows usage counts]
```

## Database

### Location
`~/.ado-tracker/database.db`

### Backups
Automatic backups are created in `~/.ado-tracker/backups/`
- Keeps last 7 backups
- Manual backup via dashboard Settings tab

### Schema
- `work_items` - All tracked work items with tags
- `tags` - Tag definitions and usage counts
- `work_item_links` - Relationships between items
- `sync_log` - History of sync operations
- `user_settings` - Dashboard preferences

## Troubleshooting

### "Azure DevOps not initialized"
- Check your PAT token is valid
- Verify organization URL is correct
- Ensure PAT has correct permissions

### "Port 3738 is busy"
- Change `DASHBOARD_PORT` in config
- Or kill the process using port 3738

### "Database locked"
- Only one instance of the tracker can run at a time
- Close other instances and restart

### Sync not working
- Verify project name is correct
- Check PAT permissions include Work Items (Read)
- Review sync history for error details

## Development

### Project Structure
```
mgc-ado-tracker/
├── src/
│   ├── index.js              # Main MCP server
│   ├── database/
│   │   ├── db.js             # Database initialization
│   │   └── workItems.js      # Work item operations
│   ├── api/
│   │   └── azureDevOps.js    # Azure DevOps API client
│   ├── sync/
│   │   └── syncService.js    # Sync service
│   ├── dashboard/
│   │   └── server.js         # Web dashboard server
│   └── utils/
│       └── aiTagging.js      # AI tagging logic
├── public/
│   ├── index.html            # Dashboard UI
│   ├── css/
│   │   └── styles.css        # Styles
│   └── js/
│       └── app.js            # Dashboard JavaScript
├── package.json
└── README.md
```

### Running in Development
```bash
npm run dev  # Starts with auto-reload
```

### Technologies
- Node.js + Express (server)
- sql.js (database)
- azure-devops-node-api (ADO integration)
- MCP SDK (Claude integration)
- Vanilla JavaScript (dashboard)

## About

Built by James Martin, Business Analyst at The Access Group.

Part of the MGC tool suite including:
- MGC Calendar Manager
- MGC Web Page Analyzer
- MGC Care Provider Finder
- And more...

## License

MIT

## Support

Issues? Questions? 
- File an issue on GitHub
- Or connect on LinkedIn: [Your LinkedIn]

---

**Stop losing track of your work items. Start using MGC ADO Tracker today.**
