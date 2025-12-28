/**
 * 🧭 Task Router - موزع المهام الذكي
 * يحلل المهام ويوجهها للأداة المناسبة
 */

import { ManusConnector } from '../connectors/manus.js';
import { GoogleAIConnector } from '../connectors/google.js';
import { CursorConnector } from '../connectors/cursor.js';
import { MemoryStore } from '../memory/store.js';

// ═══════════════════════════════════════════════════════════════
// الأنواع
// ═══════════════════════════════════════════════════════════════

export type ToolType = 'manus' | 'cursor' | 'google' | 'auto';

export interface TaskAnalysis {
    originalTask: string;
    taskType: 'execution' | 'coding' | 'analysis' | 'conversation' | 'mixed';
    suggestedTool: ToolType;
    confidence: number;
    reasoning: string;
    subtasks?: SubTask[];
}

export interface SubTask {
    id: string;
    description: string;
    tool: ToolType;
    dependencies: string[];
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: any;
}

export interface TaskResult {
    success: boolean;
    tool: ToolType;
    result?: any;
    error?: string;
    duration: number;
}

export interface RouterConfig {
    manus: ManusConnector;
    google: GoogleAIConnector;
    cursor: CursorConnector;
    memory: MemoryStore;
}

// ═══════════════════════════════════════════════════════════════
// الكلمات المفتاحية لتحديد الأداة
// ═══════════════════════════════════════════════════════════════

const MANUS_KEYWORDS = [
    // تنفيذ
    'شغل', 'نفذ', 'run', 'execute', 'start', 'stop', 'restart',
    // ملفات
    'ملف', 'مجلد', 'file', 'folder', 'directory', 'create', 'delete', 'move', 'copy',
    'اقرأ', 'اكتب', 'read', 'write', 'open', 'افتح',
    // git
    'git', 'push', 'pull', 'commit', 'clone',
    // نظام
    'install', 'ثبت', 'حمل', 'download', 'upload',
    'process', 'عملية', 'kill', 'أوقف',
    // أوامر
    'command', 'cmd', 'shell', 'terminal', 'powershell', 'أمر'
];

const CURSOR_KEYWORDS = [
    // برمجة
    'كود', 'code', 'برمج', 'program', 'script',
    'function', 'دالة', 'class', 'كلاس',
    // مشاريع
    'مشروع', 'project', 'app', 'تطبيق', 'website', 'موقع',
    // تعديل
    'عدل', 'edit', 'modify', 'fix', 'أصلح', 'صحح',
    'refactor', 'أعد كتابة', 'حسن',
    // لغات
    'javascript', 'typescript', 'python', 'react', 'node',
    'html', 'css', 'api', 'database', 'قاعدة بيانات'
];

const GOOGLE_KEYWORDS = [
    // تحليل
    'حلل', 'analyze', 'analysis', 'تحليل',
    'اشرح', 'explain', 'شرح', 'وضح',
    // بحث
    'ابحث', 'search', 'find', 'بحث',
    // محادثة
    'ما هو', 'what is', 'كيف', 'how', 'لماذا', 'why',
    'أخبرني', 'tell me', 'قل لي',
    // ملخص
    'لخص', 'summarize', 'summary', 'ملخص',
    // ترجمة
    'ترجم', 'translate', 'ترجمة'
];

// ═══════════════════════════════════════════════════════════════
// Task Router Class
// ═══════════════════════════════════════════════════════════════

export class TaskRouter {
    private manus: ManusConnector;
    private google: GoogleAIConnector;
    private cursor: CursorConnector;
    private memory: MemoryStore;

    constructor(config: RouterConfig) {
        this.manus = config.manus;
        this.google = config.google;
        this.cursor = config.cursor;
        this.memory = config.memory;
    }

    // ═══════════════════════════════════════════════════════════
    // تحليل المهمة
    // ═══════════════════════════════════════════════════════════

    /**
     * تحليل المهمة وتحديد الأداة المناسبة
     */
    async analyzeTask(task: string): Promise<TaskAnalysis> {
        // 1. تحليل سريع بالكلمات المفتاحية
        const quickAnalysis = this.quickAnalyze(task);

        // 2. إذا كانت الثقة عالية، استخدم التحليل السريع
        if (quickAnalysis.confidence >= 0.8) {
            return quickAnalysis;
        }

        // 3. استخدم Google AI للتحليل العميق
        try {
            const aiAnalysis = await this.google.analyzeTask(task);
            
            return {
                originalTask: task,
                taskType: this.determineTaskType(aiAnalysis),
                suggestedTool: aiAnalysis.suggestedTool,
                confidence: 0.9,
                reasoning: aiAnalysis.reasoning
            };
        } catch (error) {
            // fallback للتحليل السريع
            return quickAnalysis;
        }
    }

    /**
     * تحليل سريع بالكلمات المفتاحية
     */
    private quickAnalyze(task: string): TaskAnalysis {
        const taskLower = task.toLowerCase();

        // حساب النقاط لكل أداة
        let manusScore = 0;
        let cursorScore = 0;
        let googleScore = 0;

        for (const keyword of MANUS_KEYWORDS) {
            if (taskLower.includes(keyword.toLowerCase())) {
                manusScore += 1;
            }
        }

        for (const keyword of CURSOR_KEYWORDS) {
            if (taskLower.includes(keyword.toLowerCase())) {
                cursorScore += 1;
            }
        }

        for (const keyword of GOOGLE_KEYWORDS) {
            if (taskLower.includes(keyword.toLowerCase())) {
                googleScore += 1;
            }
        }

        // تحديد الأداة
        const maxScore = Math.max(manusScore, cursorScore, googleScore);
        const totalScore = manusScore + cursorScore + googleScore;

        let suggestedTool: ToolType = 'google';
        let taskType: TaskAnalysis['taskType'] = 'conversation';

        if (maxScore === manusScore && manusScore > 0) {
            suggestedTool = 'manus';
            taskType = 'execution';
        } else if (maxScore === cursorScore && cursorScore > 0) {
            suggestedTool = 'cursor';
            taskType = 'coding';
        } else if (maxScore === googleScore && googleScore > 0) {
            suggestedTool = 'google';
            taskType = 'analysis';
        }

        // حساب الثقة
        const confidence = totalScore > 0 ? maxScore / totalScore : 0.5;

        return {
            originalTask: task,
            taskType,
            suggestedTool,
            confidence,
            reasoning: `تم تحديد الأداة بناءً على الكلمات المفتاحية (${maxScore} تطابق)`
        };
    }

    /**
     * تحديد نوع المهمة
     */
    private determineTaskType(analysis: any): TaskAnalysis['taskType'] {
        if (analysis.needsExecution) return 'execution';
        if (analysis.needsCoding) return 'coding';
        if (analysis.needsAnalysis) return 'analysis';
        return 'conversation';
    }

    // ═══════════════════════════════════════════════════════════
    // تنفيذ المهمة
    // ═══════════════════════════════════════════════════════════

    /**
     * توجيه وتنفيذ المهمة
     */
    async routeAndExecute(task: string, forceTool?: ToolType): Promise<TaskResult> {
        const startTime = Date.now();

        // تحليل المهمة
        const analysis = await this.analyzeTask(task);
        const tool = forceTool || analysis.suggestedTool;

        // تسجيل في الذاكرة
        this.memory.rememberFact('tasks', 'آخر مهمة', task, {
            tags: [tool, analysis.taskType]
        });

        try {
            let result: any;

            switch (tool) {
                case 'manus':
                    result = await this.executeWithManus(task, analysis);
                    break;

                case 'cursor':
                    result = await this.executeWithCursor(task, analysis);
                    break;

                case 'google':
                default:
                    result = await this.executeWithGoogle(task, analysis);
                    break;
            }

            return {
                success: true,
                tool,
                result,
                duration: Date.now() - startTime
            };
        } catch (error: any) {
            return {
                success: false,
                tool,
                error: error.message,
                duration: Date.now() - startTime
            };
        }
    }

    // ═══════════════════════════════════════════════════════════
    // التنفيذ بكل أداة
    // ═══════════════════════════════════════════════════════════

    /**
     * تنفيذ مع Manus
     */
    private async executeWithManus(task: string, analysis: TaskAnalysis): Promise<any> {
        // استخراج الأمر من المهمة
        const command = await this.extractCommand(task);

        if (command) {
            const result = await this.manus.executeCommand(command);
            return {
                type: 'command',
                command,
                output: result.output,
                success: result.success,
                error: result.error
            };
        }

        // إذا لم نستطع استخراج أمر، نسأل Google
        const response = await this.google.chat(
            `المستخدم يريد تنفيذ هذه المهمة على جهازه: "${task}"\n\nما هو أمر PowerShell أو CMD المناسب؟ أعطني الأمر فقط بدون شرح.`
        );

        if (response.success && response.content) {
            // استخراج الأمر من الرد
            const extractedCommand = response.content.trim().replace(/```.*\n?/g, '').trim();
            const result = await this.manus.executeCommand(extractedCommand);
            
            return {
                type: 'ai_generated_command',
                command: extractedCommand,
                output: result.output,
                success: result.success,
                error: result.error
            };
        }

        throw new Error('لم أستطع فهم الأمر المطلوب');
    }

    /**
     * تنفيذ مع Cursor
     */
    private async executeWithCursor(task: string, analysis: TaskAnalysis): Promise<any> {
        // تحديد نوع مهمة البرمجة
        if (task.includes('مشروع') || task.includes('project') || task.includes('أنشئ')) {
            // إنشاء مشروع
            const projectPath = await this.extractPath(task) || 'D:\\Projects\\new-project';
            const result = await this.cursor.createProject(projectPath, {
                type: 'node',
                name: 'new-project'
            });
            return result;
        }

        if (task.includes('افتح') || task.includes('open')) {
            // فتح ملف أو مجلد
            const path = await this.extractPath(task);
            if (path) {
                await this.cursor.openFolder(path);
                return { type: 'open', path, success: true };
            }
        }

        // طلب كتابة كود من Google
        const response = await this.google.chat(
            `المستخدم يريد: "${task}"\n\nاكتب الكود المطلوب.`
        );

        return {
            type: 'code_generation',
            code: response.content,
            success: response.success
        };
    }

    /**
     * تنفيذ مع Google
     */
    private async executeWithGoogle(task: string, analysis: TaskAnalysis): Promise<any> {
        // بناء السياق
        const context = await this.memory.buildContext(undefined, task);
        const contextPrompt = this.memory.contextToPrompt(context);

        // إرسال للـ AI
        const systemPrompt = `
أنت مساعد ذكي شخصي. لديك معرفة بالمستخدم ومشاريعه.

${contextPrompt}

---

أجب على طلب المستخدم بشكل مفيد ومختصر.
`;

        const response = await this.google.chat(task, systemPrompt);

        return {
            type: 'conversation',
            response: response.content,
            success: response.success
        };
    }

    // ═══════════════════════════════════════════════════════════
    // أدوات مساعدة
    // ═══════════════════════════════════════════════════════════

    /**
     * استخراج أمر من النص
     */
    private async extractCommand(task: string): Promise<string | null> {
        // أنماط شائعة
        const patterns = [
            /شغل[:\s]+(.+)/i,
            /نفذ[:\s]+(.+)/i,
            /run[:\s]+(.+)/i,
            /execute[:\s]+(.+)/i,
            /`(.+)`/,
            /```(?:powershell|cmd|bash)?\n?(.+?)```/s
        ];

        for (const pattern of patterns) {
            const match = task.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }

        return null;
    }

    /**
     * استخراج مسار من النص
     */
    private async extractPath(task: string): Promise<string | null> {
        // أنماط المسارات
        const patterns = [
            /([A-Z]:\\[^\s"']+)/i,           // Windows path
            /(\/[^\s"']+)/,                   // Unix path
            /في[:\s]+["']?([^"'\s]+)["']?/,  // "في" + path
            /path[:\s]+["']?([^"'\s]+)["']?/i // "path" + path
        ];

        for (const pattern of patterns) {
            const match = task.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }

        return null;
    }

    // ═══════════════════════════════════════════════════════════
    // معلومات
    // ═══════════════════════════════════════════════════════════

    /**
     * حالة الموصلات
     */
    getConnectorsStatus(): Record<string, any> {
        return {
            manus: this.manus.getInfo(),
            cursor: this.cursor.getInfo(),
            google: this.google.getInfo()
        };
    }
}

// ═══════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════

export function createTaskRouter(config: RouterConfig): TaskRouter {
    return new TaskRouter(config);
}
