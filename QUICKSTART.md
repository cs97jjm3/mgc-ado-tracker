# MGC ADO Tracker - Quick Start Guide

Get up and running in 5 minutes.

## Step 1: Get Your Azure DevOps Personal Access Token

1. Go to Azure DevOps: `https://dev.azure.com/your-organization`
2. Click your profile icon (top right) → Personal access tokens
3. Click **+ New Token**
4. Give it a name: "MGC ADO Tracker"
5. Set expiration (recommend 90 days or custom)
6. **Scopes**: Select "Work Items" (Read & Write)
7. Click **Create**
8. **Copy the token immediately** (you can't see it again!)

## Step 2: Install Dependencies

```bash
cd mgc-ado-tracker
npm install
```

This installs:
- Express (web server)
- sql.js (database)
- azure-devops-node-api (Azure DevOps integration)
- @modelcontextprotocol/sdk (Claude integration)

## Step 3: Configure Claude Desktop

1. **Find your Claude config file:**
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. **Add MGC ADO Tracker:**

```json
{
  "mcpServers": {
    "mgc-ado-tracker": {
      "command": "node",
      "args": ["/Users/yourname/path/to/mgc-ado-tracker/src/index.js"],
      "env": {
        "ADO_ORG_URL": "https://dev.azure.com/your-organization",
        "ADO_PAT": "paste-your-token-here",
        "ADO_PROJECT": "YourProjectName",
        "DASHBOARD_PORT": "3738"
      }
    }
  }
}
```

**Replace:**
- `/Users/yourname/path/to/` with the actual path
- `your-organization` with your Azure DevOps org name
- `paste-your-token-here` with the PAT you copied
- `YourProjectName` with your project name (case-sensitive!)

## Step 4: Restart Claude Desktop

- **macOS**: Cmd+Q then reopen
- **Windows**: Close and reopen

Wait 10 seconds for the server to start.

## Step 5: Test It

### Open the Dashboard

Go to: `http://localhost:3738`

You should see the MGC ADO Tracker interface.

### Try Claude

In Claude, type:

```
Sync work items from my project
```

If it works, Claude will start syncing items.

### Create Your First Tracked Item

```
Create a user story in [YourProjectName]:
Title: "Test MGC ADO Tracker"
Description: "Testing the tracker installation"
```

Claude will:
1. Create it in Azure DevOps
2. Add it to the local tracker
3. Generate AI tags automatically
4. Return the work item ID

### Import Historical Data (Two Steps)

**Step 1: Fast Sync (No AI)**
1. Go to dashboard → **Sync** tab
2. Enter your project name
3. Click **Start Sync**
4. Wait (~30 seconds for 1000 items)

**Step 2: Smart Tagging (Optional)**
1. In Claude chat, type:
   ```
   Tag my pending work items
   ```
2. Claude processes items in batches using AI
3. Takes ~2-5 seconds per item for content analysis
4. Go to **Search** tab and search for anything!

## Step 6: Enable Background Sync (Optional)

In your Claude config, add:

```json
"SYNC_ENABLED": "true",
"SYNC_INTERVAL_MINUTES": "60"
```

This syncs every hour automatically.

## Troubleshooting

### "Azure DevOps not initialized"
- Check your PAT token in the config
- Verify the organization URL
- Make sure the PAT hasn't expired

### "Port 3738 is busy"
Change the port in config:
```json
"DASHBOARD_PORT": "3739"
```

### Dashboard won't load
Check if the server is running:
```bash
node src/index.js
```

Look for: "✓ MGC ADO Tracker Dashboard running at http://localhost:3738"

### Can't find config file
Create it manually:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### Import taking forever
The new two-step process is much faster:
- **Sync**: ~30 seconds for 1000 items (no AI)
- **Tagging**: ~2-5 seconds per item when you run AI tagging

You can sync quickly and tag items later in batches as needed.

## Next Steps

### Learn the Search Features
- Search by keywords: "authentication api"
- Filter by tags: "security, mobile"
- Filter by type: User Story, Bug, Task
- Filter by state: Active, Resolved

### Explore the Dashboard
- **Search Tab**: Find work items fast
- **Statistics Tab**: See charts and trends
- **Sync Tab**: Manual sync and import
- **Settings Tab**: Configure auto-tagging and backups

### Use with Claude
```
# Search
"Find all authentication work items"
"Show me bugs in the mobile area"
"What security items are in sprint 23?"

# Create
"Create a task for updating documentation"
"Add a bug for login timeout issue"

# Analyze
"What are my most common tags?"
"Show me sync status"
```

## Tips

1. **Run first import on a fast connection** - it downloads all work items
2. **Use specific search terms** - "auth login" better than "stuff"
3. **Review auto-generated tags** - they improve over time
4. **Backup regularly** - Settings tab → Backup Database
5. **Check sync history** - Sync tab shows what changed

## Getting Help

- Read the full README.md
- Check CHANGELOG.md for new features
- File issues on GitHub
- Connect on LinkedIn

---

**You're all set! Start tracking your work items the smart way.**
