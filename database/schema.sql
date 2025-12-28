-- ═══════════════════════════════════════════════════════════════
-- 🧠 Personal AI Agent - Database Schema
-- ═══════════════════════════════════════════════════════════════

-- جدول المحادثات
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_archived INTEGER DEFAULT 0,
    metadata TEXT -- JSON
);

-- جدول الرسائل
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    tool_used TEXT, -- manus, cursor, google, null
    tool_result TEXT,
    tokens_used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- جدول المشاريع
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    description TEXT,
    tech_stack TEXT, -- JSON array
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived', 'completed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- جدول ملفات المشاريع (للتتبع)
CREATE TABLE IF NOT EXISTS project_files (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    last_modified DATETIME,
    summary TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- جدول التفضيلات
CREATE TABLE IF NOT EXISTS preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL, -- JSON
    category TEXT DEFAULT 'general',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- جدول المعرفة (Knowledge Base)
CREATE TABLE IF NOT EXISTS knowledge (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source TEXT,
    source_url TEXT,
    tags TEXT, -- JSON array
    importance INTEGER DEFAULT 5 CHECK(importance BETWEEN 1 AND 10),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- جدول المهام المجدولة
CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    cron_expression TEXT,
    next_run DATETIME,
    last_run DATETIME,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'completed')),
    task_config TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- جدول سجل الأدوات (Tool Usage Log)
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

-- جدول السياق (Context)
CREATE TABLE IF NOT EXISTS context (
    id TEXT PRIMARY KEY,
    context_type TEXT NOT NULL, -- 'user', 'project', 'session'
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(context_type, key)
);

-- ═══════════════════════════════════════════════════════════════
-- الفهارس (Indexes)
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge(category);
CREATE INDEX IF NOT EXISTS idx_tool_logs_tool ON tool_logs(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_logs_created ON tool_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_context_type_key ON context(context_type, key);

-- ═══════════════════════════════════════════════════════════════
-- البيانات الأولية
-- ═══════════════════════════════════════════════════════════════

-- التفضيلات الافتراضية
INSERT OR IGNORE INTO preferences (key, value, category) VALUES
    ('language', '"ar"', 'general'),
    ('theme', '"dark"', 'ui'),
    ('default_tool', '"auto"', 'tools'),
    ('auto_save', 'true', 'general'),
    ('notification_enabled', 'true', 'notifications'),
    ('max_context_messages', '50', 'memory'),
    ('preferred_model', '"gemini-pro"', 'ai');

-- معلومات المستخدم الأساسية
INSERT OR IGNORE INTO context (id, context_type, key, value) VALUES
    ('user_name', 'user', 'name', '"المستخدم"'),
    ('user_role', 'user', 'role', '"مطور"'),
    ('user_tools', 'user', 'available_tools', '["manus", "cursor", "antigravity"]');
