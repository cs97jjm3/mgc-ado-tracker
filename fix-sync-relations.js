// Quick script to patch the syncService.js file with better relation handling

import fs from 'fs';
import path from 'path';

const filePath = 'C:\\Users\\murre\\Documents\\GitHub\\mgc-ado-tracker\\src\\sync\\syncService.js';

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the relations processing section
const oldCode = `        // Process links/relations
        if (adoItem.relations) {
          for (const relation of adoItem.relations) {
            if (relation.rel && relation.url) {
              const targetId = extractWorkItemId(relation.url);
              if (targetId) {
                addWorkItemLink(parsedItem.adoId, targetId, relation.rel, true); // Skip save during batch
                
                // Check if this is a parent link
                if (relation.rel && relation.rel.toLowerCase().includes('parent')) {
                  hasParent = true;
                  // Try to get parent type from relation attributes
                  if (relation.attributes && relation.attributes.name) {
                    parentType = relation.attributes.name;
                  }
                }
              }
            }
          }
        }`;

const newCode = `        // Process links/relations
        if (adoItem.relations) {
          // Debug: Log first few items to see what relations ADO returns
          if (i === 0 && adoItem.relations.length > 0) {
            console.error(\`\\n=== DEBUG: Work item \${adoItem.id} has \${adoItem.relations.length} relations ===\`);
            adoItem.relations.slice(0, 5).forEach((rel, idx) => {
              console.error(\`  [\${idx}] rel: "\${rel.rel}"\`);
              console.error(\`      url: "\${rel.url}"\`);
              if (rel.attributes) {
                console.error(\`      attributes.name: "\${rel.attributes.name || 'N/A'}"\`);
              }
            });
            console.error('=== END DEBUG ===\\n');
          }
          
          for (const relation of adoItem.relations) {
            if (relation.rel && relation.url) {
              const targetId = extractWorkItemId(relation.url);
              if (targetId) {
                addWorkItemLink(parsedItem.adoId, targetId, relation.rel, true); // Skip save during batch
                
                // Check if this is a parent link (child->parent relationship)
                // Azure DevOps standard hierarchy types:
                // - "System.LinkTypes.Hierarchy-Reverse" = child pointing to parent
                // - "System.LinkTypes.Hierarchy-Forward" = parent pointing to child
                if (relation.rel && (
                  relation.rel.toLowerCase().includes('parent') ||
                  relation.rel.includes('Hierarchy-Reverse')
                )) {
                  hasParent = true;
                  // Try to get parent type from relation attributes
                  if (relation.attributes && relation.attributes.name) {
                    parentType = relation.attributes.name;
                  }
                }
              }
            }
          }
        }`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Successfully patched syncService.js with improved relation handling');
  console.log('   - Added debug logging to see what relations ADO returns');
  console.log('   - Added support for Hierarchy-Reverse relation type');
  console.log('\\nNext step: Restart Claude Desktop and run sync again');
} else {
  console.log('❌ Could not find the expected code to replace');
  console.log('   The file may have already been patched or has a different structure');
}
