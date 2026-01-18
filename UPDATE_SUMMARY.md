# MGC ADO Tracker - Update Summary
## Version 1.2.1 - January 18, 2026

### Overview
Major update adding parent/child relationship tracking, automatic hierarchy tagging, URL encoding fixes, and dashboard AI tagging interface.

---

## Version History

### v1.2.1 - Dashboard AI Tagging Interface
**Added:**
- AI Tagging section in Sync tab of web dashboard
- Real-time pending tag count display
- One-click AI tagging with configurable batch size
- API endpoints for tag management
- Progress tracking in sync console

**How it works:**
1. Open dashboard at http://localhost:3738
2. Go to Sync tab
3. See count of items pending AI tagging
4. Click "Run AI Tagging" button
5. Watch progress in console
6. Tags stored permanently in database

### v1.2.0 - Automatic Hierarchy Tagging
**Added:**
- Automatic hierarchy tags during sync based on parent/child relationships
- Tags added: `orphan`, `top-level-feature`, `top-level-epic`, `has-parent`, `child-of-{type}`
- No AI required - tags added instantly during sync
- Tags preserved through subsequent AI tagging

**How it works:**
- Sync analyzes work item relationships
- Adds appropriate hierarchy tags automatically
- Items still flagged for optional AI tagging later

### v1.1.1 - URL Encoding Fix
**Fixed:**
- Project names with spaces now properly encoded
- URLs like "Meds Management" become "Meds%20Management"
- All ADO URLs now clickable everywhere

### v1.1.0 - Parent/Child Relationships
**Added:**
- `parentId` parameter - find children of specific parent
- `hasParent` boolean - find orphans (false) or items with parents (true)
- Parent and children info in work item details
- Helper functions for relationship queries

---

## New Search Capabilities

### Find Orphan Stories
```javascript
// By tag (after sync)
search_work_items({
  tags: ["orphan"],
  workItemType: "User Story"
})

// By parent filter
search_work_items({
  hasParent: false,
  workItemType: "User Story"
})
```

### Find Children of Epic
```javascript
search_work_items({
  parentId: "1856653"
})
```

### Find Top-Level Features
```javascript
// By tag
search_work_items({
  tags: ["top-level-feature"]
})

// By parent filter
search_work_items({
  hasParent: false,
  workItemType: "Feature"
})
```

---

## Tagging System

### Two-Phase Tagging

**Phase 1: Sync (Automatic)**
- Fast structural analysis
- No AI calls
- Tags added: orphan, top-level-{type}, has-parent, child-of-{type}
- Happens every sync

**Phase 2: AI Tagging (Manual)**
- Uses Claude AI
- Adds semantic tags: authentication, ui, api, database, etc.
- Takes time, uses tokens
- Run when needed via dashboard or MCP

### Tag Examples

| Item Type | Has Parent? | Hierarchy Tags | AI Tags (optional) |
|-----------|-------------|----------------|-------------------|
| User Story | No | `orphan` | `authentication`, `ui` |
| Feature | No | `top-level-feature` | `payment`, `backend` |
| User Story | Yes (Epic) | `has-parent`, `child-of-epic` | `mobile`, `api` |

---

## To Activate Changes

1. **Restart Claude Desktop** - Loads new MCP version
2. **Refresh Dashboard** - Loads new HTML/JS (http://localhost:3738)
3. **Run Sync** - Applies hierarchy tags to existing items
4. **(Optional) Run AI Tagging** - Adds semantic tags

---

## Benefits

✅ **Immediate searchability** - Find orphans right after sync
✅ **Cost control** - Run AI tagging only when needed
✅ **Dual categorization** - Structural + Semantic tags
✅ **Fast background sync** - No waiting for AI
✅ **Dashboard control** - Visual interface for tagging
✅ **Database persistence** - Tags stored permanently
✅ **Clickable URLs** - Direct links to ADO work items
