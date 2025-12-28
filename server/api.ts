/**
 * 🌐 API Server
 * واجهة HTTP للوكيل الشخصي
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { PersonalAgent, createPersonalAgent, AgentConfig } from './core/agent.js';
import { ToolType } from './core/router.js';
import { getSettingsManager, Settings } from './settings.js';

// ═══════════════════════════════════════════════════════════════
// إعداد Express
// ═══════════════════════════════════════════════════════════════

const app: express.Application = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ═══════════════════════════════════════════════════════════════
// الوكيل
// ═══════════════════════════════════════════════════════════════

let agent: PersonalAgent | null = null;

/**
 * تهيئة الوكيل
 */
async function initializeAgent(): Promise<void> {
    const config: AgentConfig = {
        databasePath: process.env.DATABASE_PATH || './data/agent.db',
        manusServerUrl: process.env.MANUS_SERVER_URL || 'http://localhost:3000',
        manusApiKey: process.env.MANUS_API_KEY,
        googleApiKey: process.env.GOOGLE_API_KEY || '',
        googleModel: process.env.GOOGLE_MODEL || 'gemini-pro',
        cursorPath: process.env.CURSOR_PATH,
        userName: process.env.USER_NAME || 'المستخدم',
        language: 'ar'
    };

    agent = createPersonalAgent(config);
    await agent.initialize();
}

// ═══════════════════════════════════════════════════════════════
// API Routes
// ═══════════════════════════════════════════════════════════════

/**
 * الصفحة الرئيسية
 */
app.get('/', (req: Request, res: Response) => {
    res.json({
        name: '🧠 Personal AI Agent',
        version: '1.0.0',
        status: agent ? 'ready' : 'not_initialized',
        endpoints: {
            chat: 'POST /api/chat',
            status: 'GET /api/status',
            conversations: 'GET /api/conversations',
            memory: 'GET /api/memory',
            projects: 'GET /api/projects'
        }
    });
});

/**
 * المحادثة
 */
app.post('/api/chat', async (req: Request, res: Response) => {
    try {
        if (!agent) {
            return res.status(503).json({
                success: false,
                error: 'الوكيل غير مهيأ'
            });
        }

        const { message, forceTool, conversationId } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'الرسالة مطلوبة'
            });
        }

        const response = await agent.chat(message, {
            forceTool: forceTool as ToolType,
            conversationId
        });

        res.json(response);
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * حالة الوكيل
 */
app.get('/api/status', (req: Request, res: Response) => {
    if (!agent) {
        return res.json({
            initialized: false,
            connectors: {},
            stats: {}
        });
    }

    res.json(agent.getStatus());
});

/**
 * المحادثات
 */
app.get('/api/conversations', (req: Request, res: Response) => {
    if (!agent) {
        return res.json([]);
    }

    const currentId = agent.getCurrentConversationId();
    const history = agent.getConversationHistory(currentId || undefined);

    res.json({
        currentConversationId: currentId,
        messages: history
    });
});

/**
 * بدء محادثة جديدة
 */
app.post('/api/conversations/new', (req: Request, res: Response) => {
    if (!agent) {
        return res.status(503).json({
            success: false,
            error: 'الوكيل غير مهيأ'
        });
    }

    const { title } = req.body;
    const conversationId = agent.startNewConversation(title);

    res.json({
        success: true,
        conversationId
    });
});

/**
 * الذاكرة
 */
app.get('/api/memory', (req: Request, res: Response) => {
    if (!agent) {
        return res.json({});
    }

    const { query } = req.query;

    if (query) {
        const results = agent.search(query as string);
        return res.json({ results });
    }

    res.json({
        stats: agent.getStatus().stats
    });
});

/**
 * تذكر معلومة
 */
app.post('/api/memory/remember', (req: Request, res: Response) => {
    if (!agent) {
        return res.status(503).json({
            success: false,
            error: 'الوكيل غير مهيأ'
        });
    }

    const { key, value } = req.body;

    if (!key || value === undefined) {
        return res.status(400).json({
            success: false,
            error: 'المفتاح والقيمة مطلوبان'
        });
    }

    agent.remember(key, value);

    res.json({
        success: true,
        message: `تم حفظ: ${key}`
    });
});

/**
 * استرجاع معلومة
 */
app.get('/api/memory/recall/:key', (req: Request, res: Response) => {
    if (!agent) {
        return res.status(503).json({
            success: false,
            error: 'الوكيل غير مهيأ'
        });
    }

    const { key } = req.params;
    const value = agent.recall(key);

    res.json({
        key,
        value
    });
});

/**
 * المشاريع
 */
app.get('/api/projects', (req: Request, res: Response) => {
    if (!agent) {
        return res.json([]);
    }

    res.json(agent.getProjects());
});

/**
 * تسجيل مشروع
 */
app.post('/api/projects', (req: Request, res: Response) => {
    if (!agent) {
        return res.status(503).json({
            success: false,
            error: 'الوكيل غير مهيأ'
        });
    }

    const { name, path, description, tech_stack } = req.body;

    if (!name || !path) {
        return res.status(400).json({
            success: false,
            error: 'الاسم والمسار مطلوبان'
        });
    }

    agent.registerProject(name, path, { description, tech_stack });

    res.json({
        success: true,
        message: `تم تسجيل المشروع: ${name}`
    });
});

/**
 * تنفيذ مباشر مع أداة محددة
 */
app.post('/api/execute/:tool', async (req: Request, res: Response) => {
    try {
        if (!agent) {
            return res.status(503).json({
                success: false,
                error: 'الوكيل غير مهيأ'
            });
        }

        const { tool } = req.params;
        const { message } = req.body;

        if (!['manus', 'cursor', 'google'].includes(tool)) {
            return res.status(400).json({
                success: false,
                error: 'أداة غير صالحة'
            });
        }

        const response = await agent.chat(message, {
            forceTool: tool as ToolType
        });

        res.json(response);
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// Settings API
// ═══════════════════════════════════════════════════════════════

/**
 * الحصول على الإعدادات
 */
app.get('/api/settings', (req: Request, res: Response) => {
    const settings = getSettingsManager();
    res.json({
        success: true,
        settings: settings.getSafeSettings()
    });
});

/**
 * حفظ الإعدادات
 */
app.post('/api/settings', async (req: Request, res: Response) => {
    try {
        const settings = getSettingsManager();
        const newSettings: Partial<Settings> = req.body;

        // حفظ الإعدادات
        const saved = settings.saveSettings(newSettings);

        if (!saved) {
            return res.status(500).json({
                success: false,
                error: 'فشل حفظ الإعدادات'
            });
        }

        res.json({
            success: true,
            message: 'تم حفظ الإعدادات بنجاح',
            settings: settings.getSafeSettings(),
            needsRestart: true
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * اختبار اتصال خدمة معينة
 */
app.post('/api/settings/test/:service', async (req: Request, res: Response) => {
    try {
        const settings = getSettingsManager();
        const { service } = req.params;

        let result;
        switch (service) {
            case 'manus':
                result = await settings.testManus();
                break;
            case 'openai':
                result = await settings.testOpenAI();
                break;
            case 'google':
                result = await settings.testGoogle();
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: 'خدمة غير معروفة'
                });
        }

        res.json({
            success: true,
            result
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * اختبار جميع الاتصالات
 */
app.get('/api/settings/test', async (req: Request, res: Response) => {
    try {
        const settings = getSettingsManager();
        const results = await settings.testAllConnections();

        res.json({
            success: true,
            results
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// Error Handler
// ═══════════════════════════════════════════════════════════════

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('❌ Error:', err);
    res.status(500).json({
        success: false,
        error: err.message
    });
});

// ═══════════════════════════════════════════════════════════════
// تشغيل الخادم
// ═══════════════════════════════════════════════════════════════

const PORT = parseInt(process.env.PORT || '4000');

async function start(): Promise<void> {
    try {
        // تهيئة الوكيل
        await initializeAgent();

        // تشغيل الخادم
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`
╔════════════════════════════════════════════════════════════╗
║           🧠 Personal AI Agent Server                      ║
╠════════════════════════════════════════════════════════════╣
║  🌐 Server: http://localhost:${PORT}                         ║
║  📚 API Docs: http://localhost:${PORT}/                      ║
╠════════════════════════════════════════════════════════════╣
║  Endpoints:                                                ║
║  • POST /api/chat         - محادثة                        ║
║  • GET  /api/status       - حالة الوكيل                   ║
║  • GET  /api/conversations - المحادثات                    ║
║  • GET  /api/memory       - الذاكرة                       ║
║  • GET  /api/projects     - المشاريع                      ║
╚════════════════════════════════════════════════════════════╝
            `);
        });
    } catch (error) {
        console.error('❌ فشل تشغيل الخادم:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 جاري إغلاق الخادم...');
    if (agent) {
        agent.close();
    }
    process.exit(0);
});

// تشغيل
start();

export default app;
