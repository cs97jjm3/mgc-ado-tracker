#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { initDatabase } from './database/db.js';
import { initAzureDevOps, createWorkItemInADO, parseWorkItemFromADO } from './api/azureDevOps.js';
import { addWorkItem, searchWorkItems, getWorkItem, getAllTags } from './database/workItems.js';
import { generateTags } from './utils/aiTagging.js';
import { syncWithAzureDevOps, getSyncStatus } from './sync/syncService.js';
import { startDashboard } from './dashboard/server.js';

// Configuration from environment
const ADO_ORG_URL = process.env.ADO_ORG_URL;
const ADO_PAT = process.env.ADO_PAT;
const ADO_PROJECT = process.env.ADO_PROJECT;
const DASHBOARD_PORT = parseInt(process.env.DASHBOARD_PORT) || 3738;
const SYNC_ENABLED = process.env.SYNC_ENABLED === 'true';
const SYNC_INTERVAL_MINUTES = parseInt(process.env.SYNC_INTERVAL_MINUTES) || 60;

// Initialize MCP server
const server = new Server(
  {
    name: 'mgc-ado-tracker',
    version: '1.0.2',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'create_work_item',
        description: 'Create a new work item in Azure DevOps and track it locally with AI-generated tags',
        inputSchema: {
          type: 'object',
          properties: {
            projectName: {
              type: 'string',
              description: 'Azure DevOps project name'
            },
            workItemType: {
              type: 'string',
              description: 'Type of work item (User Story, Task, Bug, Feature, Epic)',
              enum: ['User Story', 'Task', 'Bug', 'Feature', 'Epic', 'Issue']
            },
            title: {
              type: 'string',
              description: 'Work item title'
            },
            description: {
              type: 'string',
              description: 'Work item description'
            },
            areaPath: {
              type: 'string',
              description: 'Area path (optional)'
            },
            iterationPath: {
              type: 'string',
              description: 'Iteration path (optional)'
            },
            assignedTo: {
              type: 'string',
              description: 'Assigned to (optional)'
            }
          },
          required: ['projectName', 'workItemType', 'title']
        }
      },
      {
        name: 'search_work_items',
        description: 'Search tracked work items using natural language, tags, or filters',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (searches title and description)'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by tags (e.g., ["authentication", "security"])'
            },
            workItemType: {
              type: 'string',
              description: 'Filter by work item type'
            },
            state: {
              type: 'string',
              description: 'Filter by state (New, Active, Resolved, Closed)'
            },
            areaPath: {
              type: 'string',
              description: 'Filter by area path (partial match)'
            },
            iterationPath: {
              type: 'string',
              description: 'Filter by iteration path (partial match)'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results (default: 20)'
            }
          }
        }
      },
      {
        name: 'get_work_item',
        description: 'Get detailed information about a specific work item',
        inputSchema: {
          type: 'object',
          properties: {
            adoId: {
              type: 'string',
              description: 'Azure DevOps work item ID'
            }
          },
          required: ['adoId']
        }
      },
      {
        name: 'sync_ado',
        description: 'Sync work items from Azure DevOps to local tracker',
        inputSchema: {
          type: 'object',
          properties: {
            projectName: {
              type: 'string',
              description: 'Azure DevOps project name'
            },
            fromDate: {
              type: 'string',
              description: 'Sync items modified after this date (ISO format, optional)'
            },
            maxItems: {
              type: 'number',
              description: 'Maximum items to sync (default: 1000)'
            }
          },
          required: ['projectName']
        }
      },
      {
        name: 'get_sync_status',
        description: 'Get current sync status and last sync information',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'list_tags',
        description: 'List all available tags with usage counts',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of tags to return (default: 50)'
            }
          }
        }
      },
      {
        name: 'launch_dashboard',
        description: 'Get the URL for the MGC ADO Tracker web dashboard',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ],
  };
});

// Tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'create_work_item': {
        const { projectName, workItemType, title, description, areaPath, iterationPath, assignedTo } = args;

        // Create in Azure DevOps
        const fields = {
          'System.Title': title,
          'System.Description': description || '',
        };

        if (areaPath) fields['System.AreaPath'] = areaPath;
        if (iterationPath) fields['System.IterationPath'] = iterationPath;
        if (assignedTo) fields['System.AssignedTo'] = assignedTo;

        const adoWorkItem = await createWorkItemInADO(projectName, workItemType, fields);
        
        // Parse and add to local database
        const parsedItem = parseWorkItemFromADO(adoWorkItem);
        
        // Generate AI tags
        const { tags, confidenceScores } = generateTags(parsedItem);
        parsedItem.tags = tags;
        parsedItem.confidenceScores = confidenceScores;
        
        addWorkItem(parsedItem);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              workItemId: adoWorkItem.id,
              title: adoWorkItem.fields['System.Title'],
              tags: tags,
              url: adoWorkItem._links.html.href
            }, null, 2)
          }]
        };
      }

      case 'search_work_items': {
        const results = searchWorkItems({
          query: args.query || '',
          tags: args.tags || [],
          workItemType: args.workItemType || '',
          state: args.state || '',
          areaPath: args.areaPath || '',
          iterationPath: args.iterationPath || '',
          limit: args.limit || 20
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              count: results.length,
              results: results.map(item => ({
                adoId: item.ado_id,
                title: item.title,
                type: item.work_item_type,
                state: item.state,
                tags: item.tags,
                areaPath: item.area_path,
                iterationPath: item.iteration_path,
                modifiedDate: item.modified_date
              }))
            }, null, 2)
          }]
        };
      }

      case 'get_work_item': {
        const item = getWorkItem(args.adoId);
        
        if (!item) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: false, error: 'Work item not found' }, null, 2)
            }]
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              workItem: {
                adoId: item.ado_id,
                title: item.title,
                description: item.description,
                type: item.work_item_type,
                state: item.state,
                areaPath: item.area_path,
                iterationPath: item.iteration_path,
                assignedTo: item.assigned_to,
                createdBy: item.created_by,
                createdDate: item.created_date,
                modifiedDate: item.modified_date,
                tags: item.tags,
                confidenceScores: item.confidence_scores
              }
            }, null, 2)
          }]
        };
      }

      case 'sync_ado': {
        const result = await syncWithAzureDevOps(args.projectName, {
          fromDate: args.fromDate,
          maxItems: args.maxItems || 1000
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: result.success,
              itemsAdded: result.itemsAdded,
              itemsUpdated: result.itemsUpdated,
              durationMs: result.durationMs,
              errors: result.errors
            }, null, 2)
          }]
        };
      }

      case 'get_sync_status': {
        const status = getSyncStatus();
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              syncStatus: status
            }, null, 2)
          }]
        };
      }

      case 'list_tags': {
        const tags = getAllTags();
        const limit = args.limit || 50;
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              count: tags.length,
              tags: tags.slice(0, limit).map(tag => ({
                name: tag.tagName,
                usageCount: tag.usageCount,
                category: tag.category
              }))
            }, null, 2)
          }]
        };
      }

      case 'launch_dashboard': {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              dashboardUrl: `http://localhost:${DASHBOARD_PORT}`,
              message: 'Open this URL in your browser to access the MGC ADO Tracker dashboard'
            }, null, 2)
          }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error.message,
          stack: error.stack
        }, null, 2)
      }],
      isError: true,
    };
  }
});

// Initialize and start server
async function main() {
  // Initialize database
  await initDatabase();

  // Initialize Azure DevOps connection if credentials provided
  if (ADO_ORG_URL && ADO_PAT) {
    await initAzureDevOps(ADO_ORG_URL, ADO_PAT);
  }

  // Start dashboard
  await startDashboard(DASHBOARD_PORT);

  // Setup background sync if enabled
  if (SYNC_ENABLED && ADO_PROJECT) {
    const intervalMs = SYNC_INTERVAL_MINUTES * 60 * 1000;
    
    setInterval(async () => {
      await syncWithAzureDevOps(ADO_PROJECT, { maxItems: 1000 });
    }, intervalMs);
  }

  // Start MCP server
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
