/**
 * 🧠 Memory Store - نظام الذاكرة الذكي
 * يدير استرجاع وتخزين المعلومات بطريقة ذكية
 */

import { DatabaseManager, Conversation, Message, Knowledge, Project } from './database.js';

// ═══════════════════════════════════════════════════════════════
// الأنواع
// ═══════════════════════════════════════════════════════════════

export interface MemoryContext {
    recentMessages: Message[];
    relevantKnowledge: Knowledge[];
    activeProjects: Project[];
    userPreferences: Record<string, any>;
    currentConversation?: Conversation;
}

export interface SearchResult {
    type: 'message' | 'knowledge' | 'project';
    content: string;
    relevance: number;
    source: any;
}

// ═══════════════════════════════════════════════════════════════
// Memory Store Class
// ═══════════════════════════════════════════════════════════════

export class MemoryStore {
    private db: DatabaseManager;

    constructor(db: DatabaseManager) {
        this.db = db;
    }

    // ═══════════════════════════════════════════════════════════
    // بناء السياق للمحادثة
    // ═══════════════════════════════════════════════════════════

    /**
     * يبني سياق كامل للمحادثة الحالية
     */
    async buildContext(conversationId?: string, query?: string): Promise<MemoryContext> {
        const context: MemoryContext = {
            recentMessages: [],
            relevantKnowledge: [],
            activeProjects: [],
            userPreferences: {}
        };

        // 1. جلب الرسائل الأخيرة
        if (conversationId) {
            context.recentMessages = this.db.getMessages(conversationId, 20);
            context.currentConversation = this.db.getConversation(conversationId) || undefined;
        } else {
            context.recentMessages = this.db.getRecentMessages(10);
        }

        // 2. جلب المعرفة ذات الصلة
        if (query) {
            context.relevantKnowledge = this.db.searchKnowledge(query).slice(0, 5);
        }

        // 3. جلب المشاريع النشطة
        context.activeProjects = this.db.getProjects('active').slice(0, 5);

        // 4. جلب التفضيلات
        context.userPreferences = this.db.getAllPreferences();

        return context;
    }

    // ═══════════════════════════════════════════════════════════
    // تحويل السياق إلى نص للـ AI
    // ═══════════════════════════════════════════════════════════

    /**
     * يحول السياق إلى نص يمكن إرساله للـ AI
     */
    contextToPrompt(context: MemoryContext): string {
        const parts: string[] = [];

        // معلومات المستخدم
        const userName = this.db.getContext('user', 'name') || 'المستخدم';
        const userRole = this.db.getContext('user', 'role') || 'مطور';
        
        parts.push(`## معلومات المستخدم`);
        parts.push(`- الاسم: ${userName}`);
        parts.push(`- الدور: ${userRole}`);
        parts.push('');

        // المشاريع النشطة
        if (context.activeProjects.length > 0) {
            parts.push(`## المشاريع النشطة`);
            for (const project of context.activeProjects) {
                parts.push(`- **${project.name}**: ${project.description || 'بدون وصف'}`);
                parts.push(`  المسار: ${project.path}`);
                if (project.tech_stack) {
                    parts.push(`  التقنيات: ${project.tech_stack.join(', ')}`);
                }
            }
            parts.push('');
        }

        // المعرفة ذات الصلة
        if (context.relevantKnowledge.length > 0) {
            parts.push(`## معلومات ذات صلة`);
            for (const knowledge of context.relevantKnowledge) {
                parts.push(`### ${knowledge.title}`);
                parts.push(knowledge.content.substring(0, 500));
                parts.push('');
            }
        }

        // الرسائل الأخيرة
        if (context.recentMessages.length > 0) {
            parts.push(`## المحادثة الأخيرة`);
            for (const msg of context.recentMessages.slice(-10)) {
                const role = msg.role === 'user' ? 'المستخدم' : 'المساعد';
                parts.push(`**${role}**: ${msg.content.substring(0, 200)}...`);
            }
        }

        return parts.join('\n');
    }

    // ═══════════════════════════════════════════════════════════
    // البحث في الذاكرة
    // ═══════════════════════════════════════════════════════════

    /**
     * يبحث في كل الذاكرة عن معلومات ذات صلة
     */
    search(query: string): SearchResult[] {
        const results: SearchResult[] = [];

        // البحث في المعرفة
        const knowledge = this.db.searchKnowledge(query);
        for (const k of knowledge) {
            results.push({
                type: 'knowledge',
                content: `${k.title}: ${k.content.substring(0, 200)}`,
                relevance: k.importance / 10,
                source: k
            });
        }

        // البحث في المشاريع
        const projects = this.db.getProjects();
        for (const p of projects) {
            if (p.name.toLowerCase().includes(query.toLowerCase()) ||
                p.description?.toLowerCase().includes(query.toLowerCase())) {
                results.push({
                    type: 'project',
                    content: `${p.name}: ${p.description || p.path}`,
                    relevance: 0.7,
                    source: p
                });
            }
        }

        // ترتيب حسب الصلة
        results.sort((a, b) => b.relevance - a.relevance);

        return results.slice(0, 10);
    }

    // ═══════════════════════════════════════════════════════════
    // حفظ المعلومات المهمة
    // ═══════════════════════════════════════════════════════════

    /**
     * يحفظ معلومة مهمة من المحادثة
     */
    rememberFact(category: string, title: string, content: string, options?: {
        source?: string;
        tags?: string[];
        importance?: number;
    }): Knowledge {
        return this.db.addKnowledge(category, title, content, options);
    }

    /**
     * يحفظ تفضيل للمستخدم
     */
    rememberPreference(key: string, value: any): void {
        this.db.setPreference(key, value);
    }

    /**
     * يحفظ معلومة عن المستخدم
     */
    rememberAboutUser(key: string, value: any): void {
        this.db.setContext('user', key, value);
    }

    // ═══════════════════════════════════════════════════════════
    // استرجاع المعلومات
    // ═══════════════════════════════════════════════════════════

    /**
     * يسترجع معلومة عن المستخدم
     */
    recallAboutUser(key: string): any {
        return this.db.getContext('user', key);
    }

    /**
     * يسترجع تفضيل
     */
    recallPreference<T = any>(key: string, defaultValue?: T): T | undefined {
        return this.db.getPreference(key, defaultValue);
    }

    /**
     * يسترجع آخر محادثة
     */
    recallLastConversation(): Conversation | null {
        const conversations = this.db.getConversations(1);
        return conversations[0] || null;
    }

    // ═══════════════════════════════════════════════════════════
    // إدارة المحادثات
    // ═══════════════════════════════════════════════════════════

    /**
     * يبدأ محادثة جديدة
     */
    startConversation(title?: string): Conversation {
        const defaultTitle = `محادثة ${new Date().toLocaleDateString('ar-SA')}`;
        return this.db.createConversation(title || defaultTitle);
    }

    /**
     * يضيف رسالة للمحادثة
     */
    addMessage(conversationId: string, role: Message['role'], content: string, options?: {
        tool_used?: string;
        tool_result?: string;
    }): Message {
        return this.db.addMessage(conversationId, role, content, options);
    }

    /**
     * يلخص المحادثة (للاستخدام مع AI)
     */
    async summarizeConversation(conversationId: string): Promise<string> {
        const messages = this.db.getMessages(conversationId);
        
        if (messages.length === 0) return 'محادثة فارغة';

        // ملخص بسيط - يمكن تحسينه باستخدام AI
        const topics = new Set<string>();
        const tools = new Set<string>();

        for (const msg of messages) {
            if (msg.tool_used) tools.add(msg.tool_used);
        }

        let summary = `محادثة تحتوي على ${messages.length} رسالة`;
        if (tools.size > 0) {
            summary += `. الأدوات المستخدمة: ${Array.from(tools).join(', ')}`;
        }

        return summary;
    }

    // ═══════════════════════════════════════════════════════════
    // إدارة المشاريع
    // ═══════════════════════════════════════════════════════════

    /**
     * يسجل مشروع جديد
     */
    registerProject(name: string, path: string, options?: {
        description?: string;
        tech_stack?: string[];
    }): Project {
        return this.db.createProject(name, path, options);
    }

    /**
     * يجلب المشاريع النشطة
     */
    getActiveProjects(): Project[] {
        return this.db.getProjects('active');
    }

    // ═══════════════════════════════════════════════════════════
    // إحصائيات
    // ═══════════════════════════════════════════════════════════

    /**
     * يجلب إحصائيات الذاكرة
     */
    getStats(): {
        conversations: number;
        messages: number;
        projects: number;
        knowledge: number;
    } {
        const conversations = this.db.getConversations(1000, true).length;
        const projects = this.db.getProjects().length;
        const knowledge = this.db.searchKnowledge('').length;
        
        // حساب الرسائل
        let messages = 0;
        for (const conv of this.db.getConversations(1000, true)) {
            messages += this.db.getMessages(conv.id, 10000).length;
        }

        return { conversations, messages, projects, knowledge };
    }
}
