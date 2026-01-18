# MGC ADO Tracker - Tagging Guide

## How Tagging Works

Tagging happens in **two phases**:

### Phase 1: Sync (Automatic Hierarchy Tags)
When you run `sync_ado_work_items`, the system:
1. Fetches work items from Azure DevOps
2. Analyzes parent/child relationships
3. **Automatically adds hierarchy tags** based on structure:
   - `orphan` - User Stories, Tasks, or Bugs with no parent
   - `top-level-feature` - Features with no parent
   - `top-level-epic` - Epics with no parent
   - `has-parent` - Any item that has a parent link
   - `child-of-{type}` - e.g., "child-of-epic", "child-of-feature"
4. Flags items as needing AI tagging (`needs_tagging = 1`)

### Phase 2: AI Tagging (Manual)
After sync, you can run `tag_pending_work_items` to:
1. Process items flagged for tagging
2. Generate semantic tags using AI (authentication, ui, api, etc.)
3. Merge AI tags with existing hierarchy tags
4. Mark items as tagged (`needs_tagging = 0`)

## Why Two Phases?

- **Phase 1 is fast** - No AI calls, just structural analysis
- **Phase 2 is slow** - AI processing takes time and costs tokens
- **You control when AI runs** - Sync can happen in background, AI tagging on-demand

## Example Workflow

```javascript
// Step 1: Sync from Azure DevOps (adds hierarchy tags automatically)
sync_ado_work_items({
  projectName: "Meds Management",
  maxItems: 1000
})
// Result: Items now have "orphan", "top-level-feature", etc. tags

// Step 2: Search by hierarchy tags immediately
search_work_items({
  tags: ["orphan"],
  workItemType: "User Story"
})

// Step 3: Optionally add AI tags later for richer categorization
tag_pending_work_items({
  batchSize: 10,
  confidenceThreshold: 0.8
})
// Result: Items now have both hierarchy tags AND semantic tags
```

## Finding Items by Hierarchy

### Find Orphan Stories
```javascript
search_work_items({
  tags: ["orphan"],
  workItemType: "User Story"
})
```

### Find Top-Level Features
```javascript
search_work_items({
  tags: ["top-level-feature"]
})
```

### Find Items with Parents
```javascript
search_work_items({
  tags: ["has-parent"]
})
```

### Alternative: Use Parent Filters
You can also use the new `hasParent` parameter:
```javascript
// Find orphans
search_work_items({
  hasParent: false,
  workItemType: "User Story"
})

// Find items with parents
search_work_items({
  hasParent: true
})
```

## Tag Preservation

- **Hierarchy tags are never overwritten** - They persist through AI tagging
- **Tags are merged** - AI tags are added alongside hierarchy tags
- **Existing tags are preserved** - If an item already has tags, they're kept

## When Tags Are Added

| Action | Hierarchy Tags | AI Tags |
|--------|---------------|---------|
| First sync | ✅ Added automatically | ❌ Not added (flagged for later) |
| Re-sync existing item with tags | ✅ Preserved | ✅ Preserved |
| Re-sync existing item without tags | ✅ Added | ❌ Not added (flagged for later) |
| tag_pending_work_items | ✅ Preserved | ✅ Added |

## Benefits

1. **Immediate searchability** - Find orphans right after sync, no AI needed
2. **Cost control** - Run AI tagging only when needed
3. **Dual categorization** - Structural (hierarchy) + Semantic (AI) tags
4. **Fast background sync** - No waiting for AI during sync
