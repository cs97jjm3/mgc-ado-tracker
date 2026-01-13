import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Get the path to Claude Desktop config file
 */
function getClaudeConfigPath() {
  const platform = os.platform();
  
  if (platform === 'win32') {
    return path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json');
  } else if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else {
    // Linux
    return path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
  }
}

/**
 * Read Claude Desktop config
 */
export function readClaudeConfig() {
  try {
    const configPath = getClaudeConfigPath();
    
    if (!fs.existsSync(configPath)) {
      throw new Error('Claude Desktop config not found');
    }
    
    const configContent = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configContent);
  } catch (error) {
    throw new Error(`Failed to read Claude config: ${error.message}`);
  }
}

/**
 * Write Claude Desktop config
 */
export function writeClaudeConfig(config) {
  try {
    const configPath = getClaudeConfigPath();
    
    // Create backup
    if (fs.existsSync(configPath)) {
      const backupPath = `${configPath}.backup`;
      fs.copyFileSync(configPath, backupPath);
    }
    
    // Write new config with nice formatting
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    
    return true;
  } catch (error) {
    throw new Error(`Failed to write Claude config: ${error.message}`);
  }
}

/**
 * Get current MGC ADO Tracker settings from Claude config
 */
export function getCurrentSettings() {
  try {
    const config = readClaudeConfig();
    
    // Find mgc-ado-tracker in mcpServers
    const mcpServers = config.mcpServers || {};
    const trackerConfig = mcpServers['mgc-ado-tracker'] || mcpServers['MGC ADO Tracker'];
    
    if (!trackerConfig) {
      return {
        found: false,
        env: {}
      };
    }
    
    return {
      found: true,
      env: trackerConfig.env || {},
      command: trackerConfig.command,
      args: trackerConfig.args
    };
  } catch (error) {
    return {
      found: false,
      error: error.message,
      env: {}
    };
  }
}

/**
 * Update MGC ADO Tracker settings in Claude config
 */
export function updateSettings(newEnvVars) {
  try {
    const config = readClaudeConfig();
    
    // Ensure mcpServers exists
    if (!config.mcpServers) {
      config.mcpServers = {};
    }
    
    // Find our server (could be 'mgc-ado-tracker' or 'MGC ADO Tracker')
    let serverKey = 'mgc-ado-tracker';
    if (!config.mcpServers[serverKey] && config.mcpServers['MGC ADO Tracker']) {
      serverKey = 'MGC ADO Tracker';
    }
    
    // If not found at all, create it
    if (!config.mcpServers[serverKey]) {
      config.mcpServers[serverKey] = {
        command: 'node',
        args: [path.join(process.cwd(), 'src', 'index.js')]
      };
    }
    
    // Update env vars
    if (!config.mcpServers[serverKey].env) {
      config.mcpServers[serverKey].env = {};
    }
    
    // Merge new env vars (only update provided values)
    Object.keys(newEnvVars).forEach(key => {
      if (newEnvVars[key] !== undefined && newEnvVars[key] !== '') {
        config.mcpServers[serverKey].env[key] = newEnvVars[key];
      }
    });
    
    // Write back
    writeClaudeConfig(config);
    
    return {
      success: true,
      message: 'Settings updated successfully. Please restart Claude Desktop for changes to take effect.',
      updatedKeys: Object.keys(newEnvVars)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get all current environment variables (including those set by Claude)
 */
export function getAllEnvVars() {
  return {
    ADO_ORG_URL: process.env.ADO_ORG_URL || '',
    ADO_PAT: process.env.ADO_PAT ? '***hidden***' : '',
    ADO_PROJECT: process.env.ADO_PROJECT || '',
    DASHBOARD_PORT: process.env.DASHBOARD_PORT || '3738',
    SYNC_ENABLED: process.env.SYNC_ENABLED || 'false',
    SYNC_INTERVAL_MINUTES: process.env.SYNC_INTERVAL_MINUTES || '60',
    AUTO_TAG_NEW_ITEMS: process.env.AUTO_TAG_NEW_ITEMS || 'true',
    TAG_CONFIDENCE_THRESHOLD: process.env.TAG_CONFIDENCE_THRESHOLD || '0.7'
  };
}
