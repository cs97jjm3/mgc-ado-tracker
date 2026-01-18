import * as azdev from 'azure-devops-node-api';

let connection = null;
let witApi = null;

export async function initAzureDevOps(orgUrl, pat) {
  try {
    const authHandler = azdev.getPersonalAccessTokenHandler(pat);
    connection = new azdev.WebApi(orgUrl, authHandler);
    witApi = await connection.getWorkItemTrackingApi();
    
    return true;
  } catch (error) {
    console.error('Failed to connect to Azure DevOps:', error.message);
    throw error;
  }
}

export async function getWorkItemsFromADO(projectName, options = {}) {
  if (!witApi) {
    throw new Error('Azure DevOps not initialized');
  }

  const {
    fromDate = null,
    maxItems = 1000,
    wiql = null
  } = options;

  try {
    let query = wiql;
    
    if (!query) {
      // Default query - all work items in project
      query = `
        SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType],
               [System.AreaPath], [System.IterationPath], [System.AssignedTo],
               [System.CreatedBy], [System.CreatedDate], [System.ChangedDate]
        FROM WorkItems
        WHERE [System.TeamProject] = '${projectName}'
        ${fromDate ? `AND [System.ChangedDate] >= '${fromDate}'` : ''}
        ORDER BY [System.ChangedDate] DESC
      `;
    }

    const queryResult = await witApi.queryByWiql({ query }, projectName);
    
    if (!queryResult.workItems || queryResult.workItems.length === 0) {
      return [];
    }

    // Get IDs
    const ids = queryResult.workItems.slice(0, maxItems).map(wi => wi.id);

    // Fetch full work item details in batches
    const batchSize = 200;
    const workItems = [];
    
    for (let i = 0; i < ids.length; i += batchSize) {
      const batchIds = ids.slice(i, i + batchSize);
      const batch = await witApi.getWorkItems(
        batchIds,
        undefined, // fields - must be undefined, not null  
        undefined, // asOf
        'all' // expand (get relations)
      );
      workItems.push(...batch);
    }

    return workItems;
  } catch (error) {
    console.error('Failed to fetch work items from ADO:', error.message);
    throw error;
  }
}

export async function getWorkItemByIdFromADO(id, projectName) {
  if (!witApi) {
    throw new Error('Azure DevOps not initialized');
  }

  try {
    const workItem = await witApi.getWorkItem(id, projectName, undefined, null, 'all');
    return workItem;
  } catch (error) {
    console.error(`Failed to fetch work item ${id}:`, error.message);
    throw error;
  }
}

export async function createWorkItemInADO(projectName, workItemType, fields) {
  if (!witApi) {
    throw new Error('Azure DevOps not initialized');
  }

  try {
    const document = [];
    
    for (const [field, value] of Object.entries(fields)) {
      document.push({
        op: 'add',
        path: `/fields/${field}`,
        value: value
      });
    }

    const workItem = await witApi.createWorkItem(
      undefined, // custom headers
      document,
      projectName,
      workItemType
    );

    return workItem;
  } catch (error) {
    console.error('Failed to create work item:', error.message);
    throw error;
  }
}

export async function updateWorkItemInADO(id, projectName, fields) {
  if (!witApi) {
    throw new Error('Azure DevOps not initialized');
  }

  try {
    const document = [];
    
    for (const [field, value] of Object.entries(fields)) {
      document.push({
        op: 'add',
        path: `/fields/${field}`,
        value: value
      });
    }

    const workItem = await witApi.updateWorkItem(
      undefined, // custom headers
      document,
      id,
      projectName
    );

    return workItem;
  } catch (error) {
    console.error(`Failed to update work item ${id}:`, error.message);
    throw error;
  }
}

export async function getProjects() {
  if (!connection) {
    throw new Error('Azure DevOps not initialized');
  }

  try {
    const coreApi = await connection.getCoreApi();
    const projects = await coreApi.getProjects();
    return projects;
  } catch (error) {
    console.error('Failed to fetch projects:', error.message);
    throw error;
  }
}

export function parseWorkItemFromADO(adoWorkItem) {
  const fields = adoWorkItem.fields || {};
  
  return {
    adoId: adoWorkItem.id.toString(),
    title: fields['System.Title'] || '',
    description: fields['System.Description'] || '',
    workItemType: fields['System.WorkItemType'] || '',
    state: fields['System.State'] || '',
    areaPath: fields['System.AreaPath'] || '',
    iterationPath: fields['System.IterationPath'] || '',
    assignedTo: fields['System.AssignedTo']?.displayName || '',
    createdBy: fields['System.CreatedBy']?.displayName || '',
    createdDate: fields['System.CreatedDate'] || '',
    modifiedDate: fields['System.ChangedDate'] || '',
    projectName: fields['System.TeamProject'] || '',
    
    // Rich text fields
    acceptanceCriteria: fields['Microsoft.VSTS.Common.AcceptanceCriteria'] || '',
    reproSteps: fields['Microsoft.VSTS.TCM.ReproSteps'] || '',
    systemInfo: fields['Microsoft.VSTS.TCM.SystemInfo'] || '',
    
    // Planning & priority
    priority: fields['Microsoft.VSTS.Common.Priority'] || null,
    severity: fields['Microsoft.VSTS.Common.Severity'] || '',
    storyPoints: fields['Microsoft.VSTS.Scheduling.StoryPoints'] || null,
    businessValue: fields['Microsoft.VSTS.Common.BusinessValue'] || null,
    risk: fields['Microsoft.VSTS.Common.Risk'] || '',
    
    // Version/build info
    foundInBuild: fields['Microsoft.VSTS.Build.FoundIn'] || '',
    integrationBuild: fields['Microsoft.VSTS.Build.IntegrationBuild'] || '',
    
    // Workflow tracking
    resolvedBy: fields['Microsoft.VSTS.Common.ResolvedBy']?.displayName || '',
    resolvedDate: fields['Microsoft.VSTS.Common.ResolvedDate'] || '',
    closedBy: fields['Microsoft.VSTS.Common.ClosedBy']?.displayName || '',
    closedDate: fields['Microsoft.VSTS.Common.ClosedDate'] || '',
    activatedBy: fields['Microsoft.VSTS.Common.ActivatedBy']?.displayName || '',
    activatedDate: fields['Microsoft.VSTS.Common.ActivatedDate'] || '',
    stateReason: fields['System.Reason'] || '',
    
    // Effort tracking
    originalEstimate: fields['Microsoft.VSTS.Scheduling.OriginalEstimate'] || null,
    remainingWork: fields['Microsoft.VSTS.Scheduling.RemainingWork'] || null,
    completedWork: fields['Microsoft.VSTS.Scheduling.CompletedWork'] || null,
    
    // ADO native tags
    adoTags: fields['System.Tags'] || '',
    
    tags: [], // Will be added by AI tagging
    confidenceScores: {},
    rawData: adoWorkItem
  };
}

export function getConnection() {
  return connection;
}

export function getWitApi() {
  return witApi;
}
