// AI Tagging Service
// Uses Claude AI for intelligent tagging with fallback to keyword matching

import Anthropic from '@anthropic-ai/sdk';

const TAG_PATTERNS = {
  // Security & Authentication
  'authentication': ['auth', 'login', 'signin', 'sign-in', 'password', 'credential', 'sso', 'oauth', 'saml'],
  'security': ['security', 'secure', 'permission', 'access control', 'authorization', 'encrypt', 'decrypt'],
  'audit': ['audit', 'logging', 'log', 'tracking', 'compliance'],
  
  // Payment & Financial
  'payment': ['payment', 'pay', 'billing', 'invoice', 'transaction', 'checkout'],
  'finance': ['financial', 'accounting', 'ledger', 'revenue', 'cost'],
  
  // UI & Frontend
  'ui': ['ui', 'user interface', 'frontend', 'display', 'screen', 'page', 'view'],
  'mobile': ['mobile', 'ios', 'android', 'app', 'responsive'],
  'dashboard': ['dashboard', 'analytics', 'reporting', 'metrics', 'chart', 'graph'],
  
  // Backend & API
  'api': ['api', 'endpoint', 'rest', 'graphql', 'service', 'microservice'],
  'database': ['database', 'db', 'sql', 'query', 'schema', 'migration', 'postgres', 'mysql'],
  'integration': ['integration', 'integrate', 'connector', 'webhook', 'sync'],
  
  // Infrastructure
  'devops': ['devops', 'ci/cd', 'pipeline', 'deployment', 'release', 'build'],
  'infrastructure': ['infrastructure', 'server', 'cloud', 'azure', 'aws', 'kubernetes', 'docker'],
  'performance': ['performance', 'optimize', 'speed', 'cache', 'latency'],
  
  // Testing & Quality
  'testing': ['test', 'testing', 'qa', 'quality', 'automated test', 'unit test', 'integration test'],
  'bug': ['bug', 'defect', 'issue', 'error', 'fix', 'broken'],
  
  // Documentation & Process
  'documentation': ['documentation', 'docs', 'readme', 'guide', 'manual'],
  'research': ['research', 'spike', 'investigation', 'analysis', 'explore'],
  
  // Business Areas
  'customer': ['customer', 'user', 'client', 'account'],
  'reporting': ['report', 'export', 'download', 'pdf', 'excel'],
  'notification': ['notification', 'alert', 'email', 'sms', 'push'],
  'workflow': ['workflow', 'process', 'automation', 'trigger'],
  
  // Data
  'data': ['data', 'dataset', 'import', 'export', 'etl', 'migration'],
  'analytics': ['analytics', 'insights', 'metrics', 'statistics', 'trends']
};

const WORK_ITEM_TYPE_TAGS = {
  'User Story': ['story', 'feature'],
  'Bug': ['bug', 'defect'],
  'Task': ['task'],
  'Epic': ['epic'],
  'Feature': ['feature'],
  'Issue': ['issue']
};

const STATE_TAGS = {
  'New': ['new'],
  'Active': ['active', 'in-progress'],
  'Resolved': ['resolved', 'completed'],
  'Closed': ['closed', 'done']
};

// Available tag categories for Claude to choose from
const AVAILABLE_TAGS = [
  // Technical
  'authentication', 'security', 'audit', 'payment', 'finance',
  'ui', 'mobile', 'dashboard', 'api', 'database', 'integration',
  'devops', 'infrastructure', 'performance', 'testing', 'bug',
  // Process
  'documentation', 'research', 'customer', 'reporting', 'notification',
  'workflow', 'data', 'analytics',
  // Work type
  'backend', 'frontend', 'full-stack', 'urgent', 'enhancement',
  'refactoring', 'migration', 'configuration'
];

let anthropicClient = null;

// Initialize Anthropic client
function getAnthropicClient() {
  if (!anthropicClient) {
    // Claude Desktop provides API access without needing an API key
    anthropicClient = new Anthropic({
      apiKey: 'dummy-key' // Not needed in Claude Desktop context
    });
  }
  return anthropicClient;
}

// Enhanced tagging using Claude AI
export async function generateTagsWithAI(workItem, options = {}) {
  const { confidenceThreshold = 0.5, useAI = true } = options;
  
  // Try AI tagging first if enabled
  if (useAI) {
    try {
      return await generateTagsUsingClaude(workItem, confidenceThreshold);
    } catch (error) {
      console.error('AI tagging failed, falling back to pattern matching:', error.message);
    }
  }
  
  // Fallback to pattern matching
  return generateTags(workItem, { confidenceThreshold });
}

// Use Claude AI to generate intelligent tags
async function generateTagsUsingClaude(workItem, confidenceThreshold) {
  const client = getAnthropicClient();
  
  const prompt = `Analyze this work item and suggest relevant tags from the available list.

Work Item:
Title: ${workItem.title}
Description: ${workItem.description || 'No description'}
Type: ${workItem.workItemType}
State: ${workItem.state}
Area: ${workItem.areaPath || 'N/A'}

Available Tags: ${AVAILABLE_TAGS.join(', ')}

For each suggested tag, provide:
1. The tag name (must be from the available list)
2. A confidence score (0.0 to 1.0)
3. Brief reason why this tag applies

Respond in JSON format:
{
  "tags": [
    {"tag": "tag-name", "confidence": 0.85, "reason": "explanation"},
    ...
  ]
}

Only suggest tags with confidence >= ${confidenceThreshold}. Focus on the 3-5 most relevant tags.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  const responseText = response.content[0].text;
  
  // Parse Claude's response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse AI response');
  }
  
  const parsed = JSON.parse(jsonMatch[0]);
  
  const tags = new Set();
  const confidenceScores = {};
  
  // Add AI-suggested tags
  parsed.tags.forEach(item => {
    if (AVAILABLE_TAGS.includes(item.tag) && item.confidence >= confidenceThreshold) {
      tags.add(item.tag);
      confidenceScores[item.tag] = item.confidence;
    }
  });
  
  // Always add work item type tags
  if (workItem.workItemType && WORK_ITEM_TYPE_TAGS[workItem.workItemType]) {
    WORK_ITEM_TYPE_TAGS[workItem.workItemType].forEach(tag => {
      tags.add(tag);
      confidenceScores[tag] = 1.0;
    });
  }
  
  // Add area path tags
  if (workItem.areaPath) {
    const areaPathParts = workItem.areaPath.split('\\').filter(p => p.length > 0);
    areaPathParts.forEach(part => {
      const normalized = part.toLowerCase().replace(/[^a-z0-9]/g, '-');
      if (normalized.length > 2) {
        tags.add(`area-${normalized}`);
        confidenceScores[`area-${normalized}`] = 0.8;
      }
    });
  }
  
  return {
    tags: Array.from(tags),
    confidenceScores,
    aiGenerated: true
  };
}

export function generateTags(workItem, options = {}) {
  const { confidenceThreshold = 0.5 } = options;
  
  const text = `${workItem.title} ${workItem.description}`.toLowerCase();
  const tags = new Set();
  const confidenceScores = {};

  // Add work item type tags
  if (workItem.workItemType && WORK_ITEM_TYPE_TAGS[workItem.workItemType]) {
    WORK_ITEM_TYPE_TAGS[workItem.workItemType].forEach(tag => {
      tags.add(tag);
      confidenceScores[tag] = 1.0;
    });
  }

  // Add state tags
  if (workItem.state && STATE_TAGS[workItem.state]) {
    STATE_TAGS[workItem.state].forEach(tag => {
      tags.add(tag);
      confidenceScores[tag] = 1.0;
    });
  }

  // Pattern matching with confidence scoring
  for (const [tag, patterns] of Object.entries(TAG_PATTERNS)) {
    let matches = 0;
    let totalPatterns = patterns.length;
    
    for (const pattern of patterns) {
      if (text.includes(pattern)) {
        matches++;
      }
    }

    if (matches > 0) {
      const confidence = Math.min(matches / totalPatterns + 0.5, 1.0);
      
      if (confidence >= confidenceThreshold) {
        tags.add(tag);
        confidenceScores[tag] = parseFloat(confidence.toFixed(2));
      }
    }
  }

  // Extract keywords from area path
  if (workItem.areaPath) {
    const areaPathParts = workItem.areaPath.split('\\').filter(p => p.length > 0);
    areaPathParts.forEach(part => {
      const normalized = part.toLowerCase().replace(/[^a-z0-9]/g, '-');
      if (normalized.length > 2) {
        tags.add(`area-${normalized}`);
        confidenceScores[`area-${normalized}`] = 0.8;
      }
    });
  }

  // Extract keywords from iteration
  if (workItem.iterationPath) {
    const iterationParts = workItem.iterationPath.split('\\').filter(p => p.length > 0);
    const lastPart = iterationParts[iterationParts.length - 1];
    if (lastPart) {
      const normalized = lastPart.toLowerCase().replace(/[^a-z0-9]/g, '-');
      if (normalized.length > 2) {
        tags.add(`iteration-${normalized}`);
        confidenceScores[`iteration-${normalized}`] = 0.7;
      }
    }
  }

  return {
    tags: Array.from(tags),
    confidenceScores
  };
}

export function suggestAreaPath(workItem, existingAreaPaths = []) {
  const tags = generateTags(workItem).tags;
  
  // Simple suggestion based on tags
  const suggestions = [];
  
  for (const areaPath of existingAreaPaths) {
    let score = 0;
    const pathLower = areaPath.toLowerCase();
    
    for (const tag of tags) {
      if (pathLower.includes(tag)) {
        score++;
      }
    }
    
    if (score > 0) {
      suggestions.push({ areaPath, score, tags: tags.filter(t => pathLower.includes(t)) });
    }
  }
  
  return suggestions.sort((a, b) => b.score - a.score);
}

export function suggestIteration(workItem, existingIterations = []) {
  // For now, suggest based on state
  if (workItem.state === 'New') {
    return existingIterations.filter(i => i.includes('Backlog') || i.includes('Future'));
  }
  
  if (workItem.state === 'Active') {
    return existingIterations.filter(i => i.includes('Current') || i.includes('Sprint'));
  }
  
  return [];
}

export function categorizeTag(tag) {
  // Categorize tags for better organization
  const categories = {
    technical: ['api', 'database', 'infrastructure', 'devops', 'performance'],
    security: ['authentication', 'security', 'audit'],
    business: ['payment', 'finance', 'customer', 'reporting'],
    ui: ['ui', 'mobile', 'dashboard'],
    quality: ['testing', 'bug'],
    process: ['documentation', 'research', 'workflow']
  };

  for (const [category, tags] of Object.entries(categories)) {
    if (tags.includes(tag)) {
      return category;
    }
  }

  if (tag.startsWith('area-')) return 'area';
  if (tag.startsWith('iteration-')) return 'iteration';
  
  return 'other';
}

export function getTagStats(workItems) {
  const tagCounts = {};
  const tagsByCategory = {};
  
  workItems.forEach(item => {
    if (item.tags) {
      item.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        
        const category = categorizeTag(tag);
        if (!tagsByCategory[category]) {
          tagsByCategory[category] = {};
        }
        tagsByCategory[category][tag] = (tagsByCategory[category][tag] || 0) + 1;
      });
    }
  });

  return {
    tagCounts,
    tagsByCategory,
    topTags: Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count }))
  };
}
