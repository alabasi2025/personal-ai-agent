/**
 * 🔌 Connectors Index
 * تصدير جميع موصلات الأدوات
 */

// Manus Connector
export { ManusConnector, createManusConnector } from './manus.js';
export type { ManusConfig, CommandResult, FileInfo, TaskInfo } from './manus.js';

// Google AI Connector
export { GoogleAIConnector, createGoogleAIConnector } from './google.js';
export type { GoogleAIConfig, ChatMessage, ChatResponse, AnalysisResult } from './google.js';

// Cursor Connector
export { CursorConnector, createCursorConnector } from './cursor.js';
export type { CursorConfig, CodeTask, CodeResult, ProjectInfo } from './cursor.js';
