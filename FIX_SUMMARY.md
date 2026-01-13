# MGC ADO Tracker v1.0.1 - Fix Summary

## Problem
The MGC ADO Tracker MCP server was generating "Invalid JSON-RPC message" errors in Claude Desktop, preventing it from working properly.

## Root Cause
The server was using `console.log()` statements for startup banners and progress messages. In the MCP protocol, stdout must be reserved exclusively for JSON-RPC messages. Any other output to stdout corrupts the message stream and causes protocol violations.

## Solution
Changed all `console.log()` statements to `console.error()` throughout the codebase. This redirects informational messages to stderr, leaving stdout clean for the MCP protocol.

## Files Changed
1. **src/index.js** - Main server startup and initialization
2. **src/dashboard/server.js** - Dashboard startup messages
3. **src/sync/syncService.js** - Sync progress and completion messages
4. **src/api/azureDevOps.js** - Azure DevOps connection and API messages
5. **package.json** - Version bump to 1.0.1
6. **CHANGELOG.md** - Added v1.0.1 release notes

## Testing
After these changes:
1. Restart Claude Desktop
2. The MCP server should initialize without JSON-RPC errors
3. All startup messages will still appear in the logs (via stderr)
4. The server should be fully functional

## Next Steps
1. Test the server in Claude Desktop
2. Verify all tools work correctly
3. Monitor logs to ensure no other protocol violations
4. Consider publishing v1.0.1 to npm if you decide to release it

## Technical Notes
- `console.error()` writes to stderr (file descriptor 2)
- `console.log()` writes to stdout (file descriptor 1)
- MCP protocol reads JSON-RPC messages from stdout only
- All logging, debugging, and informational output should use stderr
