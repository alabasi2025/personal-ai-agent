/**
 * 💾 Database Manager - إدارة قاعدة البيانات
 * نظام الذاكرة الدائمة للوكيل الشخصي
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

// ═══════════════════════════════════════════════════════════════
// الأنواع (Types)
// ═══════════════════════════════════════════════════════════════

export interface Conversation {
    id: string;
    title: string;
    summary?: string;
    created_at: string;
    updated_at: string;
    is_archived: boolean;
    metadata?: Record<string, any>;
}

export interface Message {
    id: string;
    conversation_id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    tool_used?: string;
    tool_result?: string;
    tokens_used?: number;
    created_at: string;
}

export interface Project {
    id: string;
    name: string;
    path: string;
    description?: string;
    tech_stack?: string[];
    status: 'active' | 'archived' | 'completed';
    created_at: string;
    updated_at: string;
}

export interface Knowledge {
    id: string;
    category: string;
    title: string;
    content: string;
    source?: string;
    source_url?: string;
    tags?: string[];
    importance: number;
    created_at: string;
    updated_at: string;
}

export interface ToolLog {
    id: string;
    tool_name: string;
    action: string;
    input?: string;
    output?: string;
    success: boolean;
    error_message?: string;
    duration_ms?: number;
    created_at: string;
}

// ═══════════════════════════════════════════════════════════════
// Database Manager Class
// ═══════════════════════════════════════════════════════════════

export class DatabaseManager {
    private db: Database.Database;
    private dbPath: string;

    constructor(dbPath?: string) {
        this.dbPath = dbPath || path.join(process.cwd(), 'data', 'agent.db');
        
        // إنشاء المجلد إذا لم يكن موجوداً
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        this.db = new Database(this.dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        
        this.initSchema();
    }

    // ═══════════════════════════════════════════════════════════
    // تهيئة قاعدة البيانات
    // ═══════════════════════════════════════════════════════════

    private initSchema(): void {
        const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
        
        if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf-8');
            this.db.exec(schema);
        } else {
            // Schema مضمن كاحتياط
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    summary TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    is_archived INTEGER DEFAULT 0,
                    metadata TEXT
                );

                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    tool_used TEXT,
                    tool_result TEXT,
                    tokens_used INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    path TEXT NOT NULL,
                    description TEXT,
                    tech_stack TEXT,
                    status TEXT DEFAULT 'active',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS knowledge (
                    id TEXT PRIMARY KEY,
                    category TEXT NOT NULL,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    source TEXT,
                    source_url TEXT,
                    tags TEXT,
                    importance INTEGER DEFAULT 5,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS preferences (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    category TEXT DEFAULT 'general',
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS tool_logs (
                    id TEXT PRIMARY KEY,
                    tool_name TEXT NOT NULL,
                    action TEXT NOT NULL,
                    input TEXT,
                    output TEXT,
                    success INTEGER DEFAULT 1,
                    error_message TEXT,
                    duration_ms INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS context (
                    id TEXT PRIMARY KEY,
                    context_type TEXT NOT NULL,
                    key TEXT NOT NULL,
                    value TEXT NOT NULL,
                    expires_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(context_type, key)
                );
            `);
        }

        console.log('✅ Database initialized');
    }

    // ═══════════════════════════════════════════════════════════
    // المحادثات (Conversations)
    // ═══════════════════════════════════════════════════════════

    createConversation(title: string, metadata?: Record<string, any>): Conversation {
        const id = uuidv4();
        const now = new Date().toISOString();

        this.db.prepare(`
            INSERT INTO conversations (id, title, metadata, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(id, title, metadata ? JSON.stringify(metadata) : null, now, now);

        return {
            id,
            title,
            created_at: now,
            updated_at: now,
            is_archived: false,
            metadata
        };
    }

    getConversation(id: string): Conversation | null {
        const row = this.db.prepare(`
            SELECT * FROM conversations WHERE id = ?
        `).get(id) as any;

        if (!row) return null;

        return {
            ...row,
            is_archived: Boolean(row.is_archived),
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined
        };
    }

    getConversations(limit = 50, includeArchived = false): Conversation[] {
        const query = includeArchived
            ? `SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ?`
            : `SELECT * FROM conversations WHERE is_archived = 0 ORDER BY updated_at DESC LIMIT ?`;

        const rows = this.db.prepare(query).all(limit) as any[];

        return rows.map(row => ({
            ...row,
            is_archived: Boolean(row.is_archived),
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined
        }));
    }

    updateConversation(id: string, updates: Partial<Conversation>): void {
        const now = new Date().toISOString();
        const fields: string[] = ['updated_at = ?'];
        const values: any[] = [now];

        if (updates.title !== undefined) {
            fields.push('title = ?');
            values.push(updates.title);
        }
        if (updates.summary !== undefined) {
            fields.push('summary = ?');
            values.push(updates.summary);
        }
        if (updates.is_archived !== undefined) {
            fields.push('is_archived = ?');
            values.push(updates.is_archived ? 1 : 0);
        }
        if (updates.metadata !== undefined) {
            fields.push('metadata = ?');
            values.push(JSON.stringify(updates.metadata));
        }

        values.push(id);

        this.db.prepare(`
            UPDATE conversations SET ${fields.join(', ')} WHERE id = ?
        `).run(...values);
    }

    deleteConversation(id: string): void {
        this.db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
    }

    // ═══════════════════════════════════════════════════════════
    // الرسائل (Messages)
    // ═══════════════════════════════════════════════════════════

    addMessage(conversationId: string, role: Message['role'], content: string, options?: {
        tool_used?: string;
        tool_result?: string;
        tokens_used?: number;
    }): Message {
        const id = uuidv4();
        const now = new Date().toISOString();

        this.db.prepare(`
            INSERT INTO messages (id, conversation_id, role, content, tool_used, tool_result, tokens_used, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            conversationId,
            role,
            content,
            options?.tool_used || null,
            options?.tool_result || null,
            options?.tokens_used || 0,
            now
        );

        // تحديث وقت المحادثة
        this.db.prepare(`
            UPDATE conversations SET updated_at = ? WHERE id = ?
        `).run(now, conversationId);

        return {
            id,
            conversation_id: conversationId,
            role,
            content,
            tool_used: options?.tool_used,
            tool_result: options?.tool_result,
            tokens_used: options?.tokens_used,
            created_at: now
        };
    }

    getMessages(conversationId: string, limit = 100): Message[] {
        const rows = this.db.prepare(`
            SELECT * FROM messages 
            WHERE conversation_id = ? 
            ORDER BY created_at ASC 
            LIMIT ?
        `).all(conversationId, limit) as any[];

        return rows;
    }

    getRecentMessages(limit = 50): Message[] {
        const rows = this.db.prepare(`
            SELECT * FROM messages 
            ORDER BY created_at DESC 
            LIMIT ?
        `).all(limit) as any[];

        return rows.reverse();
    }

    // ═══════════════════════════════════════════════════════════
    // المشاريع (Projects)
    // ═══════════════════════════════════════════════════════════

    createProject(name: string, projectPath: string, options?: {
        description?: string;
        tech_stack?: string[];
    }): Project {
        const id = uuidv4();
        const now = new Date().toISOString();

        this.db.prepare(`
            INSERT INTO projects (id, name, path, description, tech_stack, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            name,
            projectPath,
            options?.description || null,
            options?.tech_stack ? JSON.stringify(options.tech_stack) : null,
            now,
            now
        );

        return {
            id,
            name,
            path: projectPath,
            description: options?.description,
            tech_stack: options?.tech_stack,
            status: 'active',
            created_at: now,
            updated_at: now
        };
    }

    getProject(id: string): Project | null {
        const row = this.db.prepare(`
            SELECT * FROM projects WHERE id = ?
        `).get(id) as any;

        if (!row) return null;

        return {
            ...row,
            tech_stack: row.tech_stack ? JSON.parse(row.tech_stack) : undefined
        };
    }

    getProjects(status?: Project['status']): Project[] {
        const query = status
            ? `SELECT * FROM projects WHERE status = ? ORDER BY updated_at DESC`
            : `SELECT * FROM projects ORDER BY updated_at DESC`;

        const rows = status
            ? this.db.prepare(query).all(status) as any[]
            : this.db.prepare(query).all() as any[];

        return rows.map(row => ({
            ...row,
            tech_stack: row.tech_stack ? JSON.parse(row.tech_stack) : undefined
        }));
    }

    // ═══════════════════════════════════════════════════════════
    // المعرفة (Knowledge)
    // ═══════════════════════════════════════════════════════════

    addKnowledge(category: string, title: string, content: string, options?: {
        source?: string;
        source_url?: string;
        tags?: string[];
        importance?: number;
    }): Knowledge {
        const id = uuidv4();
        const now = new Date().toISOString();

        this.db.prepare(`
            INSERT INTO knowledge (id, category, title, content, source, source_url, tags, importance, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            category,
            title,
            content,
            options?.source || null,
            options?.source_url || null,
            options?.tags ? JSON.stringify(options.tags) : null,
            options?.importance || 5,
            now,
            now
        );

        return {
            id,
            category,
            title,
            content,
            source: options?.source,
            source_url: options?.source_url,
            tags: options?.tags,
            importance: options?.importance || 5,
            created_at: now,
            updated_at: now
        };
    }

    searchKnowledge(query: string, category?: string): Knowledge[] {
        const searchQuery = category
            ? `SELECT * FROM knowledge WHERE category = ? AND (title LIKE ? OR content LIKE ?) ORDER BY importance DESC`
            : `SELECT * FROM knowledge WHERE title LIKE ? OR content LIKE ? ORDER BY importance DESC`;

        const searchTerm = `%${query}%`;

        const rows = category
            ? this.db.prepare(searchQuery).all(category, searchTerm, searchTerm) as any[]
            : this.db.prepare(searchQuery).all(searchTerm, searchTerm) as any[];

        return rows.map(row => ({
            ...row,
            tags: row.tags ? JSON.parse(row.tags) : undefined
        }));
    }

    // ═══════════════════════════════════════════════════════════
    // التفضيلات (Preferences)
    // ═══════════════════════════════════════════════════════════

    setPreference(key: string, value: any, category = 'general'): void {
        const now = new Date().toISOString();

        this.db.prepare(`
            INSERT OR REPLACE INTO preferences (key, value, category, updated_at)
            VALUES (?, ?, ?, ?)
        `).run(key, JSON.stringify(value), category, now);
    }

    getPreference<T = any>(key: string, defaultValue?: T): T | undefined {
        const row = this.db.prepare(`
            SELECT value FROM preferences WHERE key = ?
        `).get(key) as any;

        if (!row) return defaultValue;

        try {
            return JSON.parse(row.value);
        } catch {
            return row.value;
        }
    }

    getAllPreferences(): Record<string, any> {
        const rows = this.db.prepare(`
            SELECT key, value FROM preferences
        `).all() as any[];

        const prefs: Record<string, any> = {};
        for (const row of rows) {
            try {
                prefs[row.key] = JSON.parse(row.value);
            } catch {
                prefs[row.key] = row.value;
            }
        }
        return prefs;
    }

    // ═══════════════════════════════════════════════════════════
    // السياق (Context)
    // ═══════════════════════════════════════════════════════════

    setContext(type: string, key: string, value: any, expiresAt?: Date): void {
        const id = `${type}_${key}`;
        const now = new Date().toISOString();

        this.db.prepare(`
            INSERT OR REPLACE INTO context (id, context_type, key, value, expires_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            type,
            key,
            JSON.stringify(value),
            expiresAt?.toISOString() || null,
            now,
            now
        );
    }

    getContext<T = any>(type: string, key: string): T | undefined {
        const row = this.db.prepare(`
            SELECT value, expires_at FROM context 
            WHERE context_type = ? AND key = ?
        `).get(type, key) as any;

        if (!row) return undefined;

        // التحقق من انتهاء الصلاحية
        if (row.expires_at && new Date(row.expires_at) < new Date()) {
            this.db.prepare(`
                DELETE FROM context WHERE context_type = ? AND key = ?
            `).run(type, key);
            return undefined;
        }

        try {
            return JSON.parse(row.value);
        } catch {
            return row.value;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // سجل الأدوات (Tool Logs)
    // ═══════════════════════════════════════════════════════════

    logToolUsage(toolName: string, action: string, input?: any, output?: any, options?: {
        success?: boolean;
        error_message?: string;
        duration_ms?: number;
    }): ToolLog {
        const id = uuidv4();
        const now = new Date().toISOString();

        this.db.prepare(`
            INSERT INTO tool_logs (id, tool_name, action, input, output, success, error_message, duration_ms, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            toolName,
            action,
            input ? JSON.stringify(input) : null,
            output ? JSON.stringify(output) : null,
            options?.success !== false ? 1 : 0,
            options?.error_message || null,
            options?.duration_ms || null,
            now
        );

        return {
            id,
            tool_name: toolName,
            action,
            input: input ? JSON.stringify(input) : undefined,
            output: output ? JSON.stringify(output) : undefined,
            success: options?.success !== false,
            error_message: options?.error_message,
            duration_ms: options?.duration_ms,
            created_at: now
        };
    }

    getToolLogs(toolName?: string, limit = 100): ToolLog[] {
        const query = toolName
            ? `SELECT * FROM tool_logs WHERE tool_name = ? ORDER BY created_at DESC LIMIT ?`
            : `SELECT * FROM tool_logs ORDER BY created_at DESC LIMIT ?`;

        const rows = toolName
            ? this.db.prepare(query).all(toolName, limit) as any[]
            : this.db.prepare(query).all(limit) as any[];

        return rows.map(row => ({
            ...row,
            success: Boolean(row.success)
        }));
    }

    // ═══════════════════════════════════════════════════════════
    // إغلاق قاعدة البيانات
    // ═══════════════════════════════════════════════════════════

    close(): void {
        this.db.close();
        console.log('✅ Database closed');
    }
}

// تصدير instance واحد
export const db = new DatabaseManager();
