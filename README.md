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
- **MCP Integration**: Works seamlessly with Claude Desktop

### AI-Generated Tags
When a work item is created or imported, the tracker analyzes it and generates tags like:
- `authentication`, `security`, `payment`, `mobile`, `api`, `testing`, `bug`
- Area-based tags: `area-security`, `area-mobile`
- Iteration-based tags: `iteration-sprint-23`

Each tag gets a confidence score so you know which are most relevant.

### Dashboard Features
- **Search Tab**: Quick search with filters for type, state, area, iteration, tags
- **Statistics Tab**: Visual charts showing work items by type, state, and top tags
- **Sync Tab**: Manual sync, import historical data, view sync history
- **Settings Tab**: Configure background sync, auto-tagging, and database management

## Installation

### Prerequisites
- Node.js 18+ 
- Azure DevOps account with Personal Access Token (PAT)
- Claude Desktop (for MCP integration)

### Setup

1. **Clone or download this repository**

2. **Install dependencies**
```bash
cd mgc-ado-tracker
npm install
```

3. **Configure Azure DevOps credentials**

Create a Personal Access Token in Azure DevOps with these permissions:
- Work Items (Read & Write)
- Project and Team (Read)

4. **Add to Claude Desktop**

Add this to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mgc-ado-tracker": {
      "command": "node",
      "args": ["/path/to/mgc-ado-tracker/src/index.js"],
      "env": {
        "ADO_ORG_URL": "https://dev.azure.com/your-organization",
        "ADO_PAT": "your-personal-access-token-here",
        "ADO_PROJECT": "YourProjectName",
        "DASHBOARD_PORT": "3738",
        "SYNC_ENABLED": "false",
        "SYNC_INTERVAL_MINUTES": "60"
      }
    }
  }
}
```

5. **Restart Claude Desktop**

6. **Open the dashboard**
```
http://localhost:3738
```

## Usage

### Creating Work Items via Claude

```
Create a user story in MyProject:
- Title: "Add OAuth2 authentication to API"
- Description: "Implement OAuth2 flow for secure API access"
```

Claude will:
1. Create the work item in Azure DevOps
2. Add it to the local tracker
3. Generate tags: `authentication`, `security`, `api`, etc.
4. Return the work item ID and URL

### Searching Work Items

Via Claude:
```
Search for all authentication-related work items
```

Via Dashboard:
- Open http://localhost:3738
- Enter keywords or select tags
- Apply filters for type, state, area, iteration

### Importing Historical Data

1. Go to the **Sync** tab in the dashboard
2. Enter your project name
3. Optionally set a "from date" to import items after that date
4. Click **Import Historical Data**

The tracker will:
- Fetch all work items from Azure DevOps
- Analyze each one and generate tags
- Store them in the local database
- Show import progress

### Background Sync

Set `SYNC_ENABLED: "true"` in your config to enable automatic background sync.

Sync runs every `SYNC_INTERVAL_MINUTES` and:
- Fetches new/updated work items from Azure
- Generates tags for new items
- Updates the local database

## Configuration Options

### Required Settings
- `ADO_ORG_URL` - Your Azure DevOps organization URL
- `ADO_PAT` - Personal Access Token
- `ADO_PROJECT` - Default project name

### Optional Settings
- `DASHBOARD_PORT` - Web dashboard port (default: 3738)
- `SYNC_ENABLED` - Enable background sync (default: false)
- `SYNC_INTERVAL_MINUTES` - Sync frequency (default: 60)
- `AUTO_TAG_NEW_ITEMS` - Auto-tag synced items (default: true)
- `TAG_CONFIDENCE_THRESHOLD` - Minimum confidence for tags (default: 0.7)

## MCP Tools

Available tools when using with Claude:

- `create_work_item` - Create work item in ADO and track locally
- `search_work_items` - Search tracked items by keywords/tags/filters
- `get_work_item` - Get detailed info about a specific item
- `sync_ado` - Manually trigger sync with Azure DevOps
- `get_sync_status` - Check sync status and last sync time
- `list_tags` - List all available tags with usage counts
- `launch_dashboard` - Get dashboard URL

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
