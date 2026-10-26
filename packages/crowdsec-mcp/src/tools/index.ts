import type { ToolDefinition } from '../types.js';
import { statusTool } from './system.js';
import { decisionTools } from './decisions.js';
import { alertTools } from './alerts.js';
import { allowlistTools } from './allowlists.js';

export function allTools(): ToolDefinition[] {
    return [statusTool, ...decisionTools, ...alertTools, ...allowlistTools];
}
