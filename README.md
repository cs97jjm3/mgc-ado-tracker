# MGC ADO Tracker

Track Azure DevOps work items with AI-powered tagging and intelligent search.

## What It Does

MGC ADO Tracker solves a real problem: **finding work items in messy Azure DevOps projects**.

- 📥 **Fast Sync**: Import work items from Azure DevOps to local database
- 🏷️ **AI Tagging**: Generate intelligent tags from work item content
- 🔍 **Smart Search**: Find items by content, not just Azure's structure
- 📊 **Web Dashboard**: Clean interface for searching and analysis with hierarchy stats
- 🤖 **Claude Integration**: Natural language search via Claude Desktop

**No more clicking through iterations and area paths hoping to find that authentication story you created 3 months ago.**

## Key Features

- **Smart Search**: Find work items by keywords, tags, or content
- **AI Tagging**: Automatically generates meaningful tags (authentication, security, mobile, etc.)
- **Hierarchy Tracking**: See parent-child relationships (Epics → Features → Stories)
- **Work Item Health**: Track tagging progress, stale items, completion rates
- **Local Database**: Fast SQLite database with your own organizational structure
- **Web Dashboard**: Clean interface at `localhost:3738`
- **MCP Integration**: Works with Claude Desktop for natural language search
- **Export**: Download as CSV or Excel

## Installation

### Prerequisites
- Node.js 18+
- Azure DevOps account with Personal Access Token
- Claude Desktop (for MCP integration)

### Quick Start

1. **Clone repository**
```bash
git clone https://github.com/yourusername/mgc-ado-tracker.git
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

5. **Open Dashboard**: http://localhost:3738

6. **Sync Work Items**
   - Go to Sync tab
   - Select project
   - Click Start Sync
   - Wait for completion (~30 seconds for 1000 items)

7. **Tag Items** (optional)
   - In Claude Desktop chat: "Tag my pending work items"
   - Or use dashboard AI Tagging panel
   - Takes ~2-5 seconds per item

## Usage

### Searching via Claude Desktop

```
You: "Did we create a story about medication reminders?"
Claude: [Searches and finds instantly]

You: "Show me all authentication bugs"
Claude: [Returns filtered results]

You: "That thing about the side menu"
Claude: [Finds: US-01: APOC Mobile: Dynamic Side Menu...]
```

### Searching via Dashboard

1. Go to Search tab
2. Enter keywords or select filters
3. Click Search
4. Click results to see details
5. Click 🔗 to open in Azure DevOps

### Syncing

**Manual Sync:**
- Sync tab → Select project → Start Sync
- Takes ~30 seconds for 1000 items

**AI Tagging:**
- After sync, use Claude chat: "Tag my pending work items"
- Or use dashboard AI Tagging panel
- Processes items in batches

### Exporting

Settings tab → Export to CSV or Excel

## MCP Tools

Available when using with Claude Desktop:

- `create_work_item` - Create work item in ADO
- `search_work_items` - Search by keywords/tags/filters
- `get_work_item` - Get item details
- `sync_ado_work_items` - Import from ADO
- `tag_pending_work_items` - Generate AI tags
- `list_tags` - Show all tags with counts
- `launch_dashboard` - Get dashboard URL

## Database

**Location**: `~/.ado-tracker/database.db`  
**Backups**: `~/.ado-tracker/backups/` (keeps last 7)

### Database Features
- Stores all work items with full metadata
- Tracks parent-child relationships via links table
- Maintains sync history and tagging status
- Auto-reloads after sync to ensure fresh data
- Supports VACUUM to reclaim space

### Statistics Available
- **Hierarchy**: Epics, Features, Orphans, Items with Children, Max Depth
- **Health**: Tagging progress, items without descriptions, completion rate
- **Activity**: Items created/closed this week/month, stale items (30/60/90 days)
- **Age**: Average age of open items, oldest open item

## Project Structure

```
mgc-ado-tracker/
├── src/
│   ├── index.js              # MCP server
│   ├── database/             # Database layer
│   ├── api/                  # Azure DevOps API
│   ├── sync/                 # Sync service
│   ├── dashboard/            # Web server
│   └── utils/                # AI tagging
├── public/                   # Dashboard UI
│   ├── index.html
│   ├── css/
│   └── js/
└── package.json
```

## Troubleshooting

**"Azure DevOps not initialized"**
- Check PAT token is valid
- Verify organization URL
- Ensure PAT has correct permissions

**"Port 3738 is busy"**
- Change `DASHBOARD_PORT` in config

**Sync not working**
- Verify project name
- Check PAT permissions
- Review sync history for errors

## Technologies

- Node.js + Express
- sql.js (SQLite)
- azure-devops-node-api
- MCP SDK
- Anthropic SDK (for AI tagging)

## About

Built by James Martin, Business Analyst at The Access Group.

Part of the MGC tool suite for Azure DevOps and business analysis workflows.

## License

MIT

---

**Stop losing track of your work items. Start using MGC ADO Tracker today.**
