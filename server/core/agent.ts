/**
 * 🧠 Personal Agent - الوكيل الشخصي
 * العقل المركزي الذي يجمع كل شيء
 */

import { DatabaseManager } from '../memory/database.js';
import { MemoryStore } from '../memory/store.js';
import { ManusConnector, createManusConnector } from '../connectors/manus.js';
import { GoogleAIConnector, createGoogleAIConnector } from '../connectors/google.js';
import { CursorConnector, createCursorConnector } from '../connectors/cursor.js';
import { AntigravityConnector, createAntigravityConnector } from '../connectors/antigravity.js';
import { TaskRouter, createTaskRouter, ToolType, TaskResult } from './router.js';

// ═══════════════════════════════════════════════════════════════
// الأنواع
// ═══════════════════════════════════════════════════════════════

export interface AgentConfig {
    // قاعدة البيانات
    databasePath: string;

    // Manus MCP
    manusServerUrl: string;
    manusApiKey?: string;

    // Google AI
    googleApiKey: string;
    googleModel?: string;

    // Cursor
    cursorPath?: string;

    // Antigravity
    antigravityPath?: string;

    // إعدادات عامة
    userName?: string;
    userRole?: string;
    language?: string;
}

export interface AgentMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    tool?: string;
    metadata?: Record<string, any>;
}

export interface AgentResponse {
    success: boolean;
    message: string;
    tool?: ToolType;
    data?: any;
    suggestions?: string[];
}

// ═══════════════════════════════════════════════════════════════
// Personal Agent Class
// ═══════════════════════════════════════════════════════════════

export class PersonalAgent {
    private config: AgentConfig;
    private db: DatabaseManager;
    private memory: MemoryStore;
    private manus: ManusConnector;
    private google: GoogleAIConnector;
    private cursor: CursorConnector;
    private antigravity: AntigravityConnector;
    private router: TaskRouter;
    private currentConversationId: string | null = null;
    private isInitialized: boolean = false;

    constructor(config: AgentConfig) {
        this.config = config;

        // إنشاء المكونات
        this.db = new DatabaseManager(config.databasePath);
        this.memory = new MemoryStore(this.db);

        this.manus = createManusConnector(config.manusServerUrl, config.manusApiKey);
        this.google = createGoogleAIConnector(config.googleApiKey, config.googleModel);
        this.cursor = createCursorConnector(this.manus, config.cursorPath);
        this.antigravity = createAntigravityConnector(this.manus, config.antigravityPath);

        this.router = createTaskRouter({
            manus: this.manus,
            google: this.google,
            cursor: this.cursor,
            memory: this.memory
        });
    }

    // ═══════════════════════════════════════════════════════════
    // التهيئة
    // ═══════════════════════════════════════════════════════════

    /**
     * تهيئة الوكيل
     */
    async initialize(): Promise<boolean> {
        try {
            console.log('🚀 جاري تهيئة الوكيل الشخصي...');

            // قاعدة البيانات تُهيأ تلقائياً في constructor
            console.log('✅ قاعدة البيانات جاهزة');

            // حفظ معلومات المستخدم
            if (this.config.userName) {
                this.memory.rememberAboutUser('name', this.config.userName);
            }
            if (this.config.userRole) {
                this.memory.rememberAboutUser('role', this.config.userRole);
            }
            if (this.config.language) {
                this.memory.rememberPreference('language', this.config.language);
            }

            // الاتصال بـ Manus
            const manusConnected = await this.manus.connect();
            if (manusConnected) {
                console.log('✅ متصل بـ Manus MCP');
            } else {
                console.log('⚠️ لم يتم الاتصال بـ Manus MCP');
            }

            // الاتصال بـ Antigravity
            if (this.config.antigravityPath) {
                const antigravityConnected = await this.antigravity.connect();
                if (antigravityConnected) {
                    console.log('✅ متصل بـ Antigravity');
                }
            }

            // بدء محادثة جديدة
            const conversation = this.memory.startConversation();
            this.currentConversationId = conversation.id;
            console.log('✅ محادثة جديدة:', conversation.id);

            this.isInitialized = true;
            console.log('🎉 الوكيل الشخصي جاهز!');

            return true;
        } catch (error) {
            console.error('❌ فشل تهيئة الوكيل:', error);
            return false;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // المحادثة
    // ═══════════════════════════════════════════════════════════

    /**
     * إرسال رسالة للوكيل
     */
    async chat(message: string, options?: {
        forceTool?: ToolType;
        conversationId?: string;
    }): Promise<AgentResponse> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const conversationId = options?.conversationId || this.currentConversationId;

        // حفظ رسالة المستخدم
        if (conversationId) {
            this.memory.addMessage(conversationId, 'user', message);
        }

        try {
            // توجيه وتنفيذ المهمة
            const result = await this.router.routeAndExecute(message, options?.forceTool);

            // بناء الرد
            const response = this.buildResponse(result);

            // حفظ رد الوكيل
            if (conversationId) {
                this.memory.addMessage(conversationId, 'assistant', response.message, {
                    tool_used: result.tool,
                    tool_result: JSON.stringify(result.result)
                });
            }

            return response;
        } catch (error: any) {
            const errorResponse: AgentResponse = {
                success: false,
                message: `حدث خطأ: ${error.message}`,
                suggestions: ['حاول مرة أخرى', 'صِغ السؤال بطريقة مختلفة']
            };

            // حفظ الخطأ
            if (conversationId) {
                this.memory.addMessage(conversationId, 'assistant', errorResponse.message);
            }

            return errorResponse;
        }
    }

    /**
     * بناء الرد من نتيجة التنفيذ
     */
    private buildResponse(result: TaskResult): AgentResponse {
        if (!result.success) {
            return {
                success: false,
                message: result.error || 'حدث خطأ غير معروف',
                tool: result.tool
            };
        }

        const data = result.result;

        // بناء الرسالة حسب نوع النتيجة
        let message = '';

        if (data.type === 'command') {
            message = data.output || 'تم تنفيذ الأمر بنجاح';
            if (data.error) {
                message += `\n\n⚠️ تحذير: ${data.error}`;
            }
        } else if (data.type === 'conversation') {
            message = data.response || 'لا يوجد رد';
        } else if (data.type === 'code_generation') {
            message = data.code || 'لم يتم توليد كود';
        } else if (data.type === 'open') {
            message = `تم فتح: ${data.path}`;
        } else {
            message = JSON.stringify(data, null, 2);
        }

        return {
            success: true,
            message,
            tool: result.tool,
            data: result.result
        };
    }

    // ═══════════════════════════════════════════════════════════
    // أوامر خاصة
    // ═══════════════════════════════════════════════════════════

    /**
     * تذكر معلومة
     */
    remember(key: string, value: any): void {
        this.memory.rememberAboutUser(key, value);
    }

    /**
     * استرجاع معلومة
     */
    recall(key: string): any {
        return this.memory.recallAboutUser(key);
    }

    /**
     * تسجيل مشروع
     */
    registerProject(name: string, path: string, options?: {
        description?: string;
        tech_stack?: string[];
    }): void {
        this.memory.registerProject(name, path, options);
    }

    /**
     * جلب المشاريع
     */
    getProjects(): any[] {
        return this.memory.getActiveProjects();
    }

    /**
     * بحث في الذاكرة
     */
    search(query: string): any[] {
        return this.memory.search(query);
    }

    // ═══════════════════════════════════════════════════════════
    // إدارة المحادثات
    // ═══════════════════════════════════════════════════════════

    /**
     * بدء محادثة جديدة
     */
    startNewConversation(title?: string): string {
        const conversation = this.memory.startConversation(title);
        this.currentConversationId = conversation.id;
        return conversation.id;
    }

    /**
     * جلب المحادثة الحالية
     */
    getCurrentConversationId(): string | null {
        return this.currentConversationId;
    }

    /**
     * جلب تاريخ المحادثة
     */
    getConversationHistory(conversationId?: string): AgentMessage[] {
        const id = conversationId || this.currentConversationId;
        if (!id) return [];

        const messages = this.db.getMessages(id);
        return messages.map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: new Date(msg.created_at),
            tool: msg.tool_used || undefined
        }));
    }

    // ═══════════════════════════════════════════════════════════
    // الحالة والإحصائيات
    // ═══════════════════════════════════════════════════════════

    /**
     * حالة الوكيل
     */
    getStatus(): {
        initialized: boolean;
        connectors: Record<string, any>;
        stats: Record<string, number>;
    } {
        return {
            initialized: this.isInitialized,
            connectors: this.router.getConnectorsStatus(),
            stats: this.memory.getStats()
        };
    }

    /**
     * إغلاق الوكيل
     */
    close(): void {
        this.db.close();
        this.isInitialized = false;
        console.log('👋 تم إغلاق الوكيل الشخصي');
    }
}

// ═══════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════

export function createPersonalAgent(config: AgentConfig): PersonalAgent {
    return new PersonalAgent(config);
}

// ═══════════════════════════════════════════════════════════════
// Default Export
// ═══════════════════════════════════════════════════════════════

export default PersonalAgent;
