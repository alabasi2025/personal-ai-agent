/**
 * ⚙️ Settings Manager - مدير الإعدادات
 * يدير إعدادات النظام ومفاتيح API
 */

import * as fs from 'fs';
import * as path from 'path';

// ═══════════════════════════════════════════════════════════════
// الأنواع
// ═══════════════════════════════════════════════════════════════

export interface Settings {
    // Server
    port: number;
    
    // Database
    databasePath: string;
    
    // Manus MCP
    manusServerUrl: string;
    manusApiKey: string;
    
    // OpenAI
    openaiApiKey: string;
    openaiModel: string;
    
    // Google AI
    googleApiKey: string;
    googleModel: string;
    
    // Cursor
    cursorPath: string;
    
    // User
    userName: string;
}

export interface ConnectionTest {
    service: string;
    connected: boolean;
    message: string;
    latency?: number;
}

// ═══════════════════════════════════════════════════════════════
// Settings Manager Class
// ═══════════════════════════════════════════════════════════════

export class SettingsManager {
    private envPath: string;
    private settings: Settings;

    constructor(envPath?: string) {
        this.envPath = envPath || path.join(process.cwd(), '.env');
        this.settings = this.loadSettings();
    }

    // ═══════════════════════════════════════════════════════════
    // تحميل وحفظ الإعدادات
    // ═══════════════════════════════════════════════════════════

    /**
     * تحميل الإعدادات من ملف .env
     */
    loadSettings(): Settings {
        const defaults: Settings = {
            port: 4000,
            databasePath: './data/agent.db',
            manusServerUrl: 'http://localhost:3000',
            manusApiKey: 'manus-local-3f00b3d8425d22115ce81751e90d5e93',
            openaiApiKey: '',
            openaiModel: 'gpt-4.1-mini',
            googleApiKey: '',
            googleModel: 'gemini-pro',
            cursorPath: '',
            userName: 'المستخدم'
        };

        // قراءة من متغيرات البيئة
        return {
            port: parseInt(process.env.PORT || '') || defaults.port,
            databasePath: process.env.DATABASE_PATH || defaults.databasePath,
            manusServerUrl: process.env.MANUS_SERVER_URL || defaults.manusServerUrl,
            manusApiKey: process.env.MANUS_API_KEY || defaults.manusApiKey,
            openaiApiKey: process.env.OPENAI_API_KEY || defaults.openaiApiKey,
            openaiModel: process.env.OPENAI_MODEL || defaults.openaiModel,
            googleApiKey: process.env.GOOGLE_API_KEY || defaults.googleApiKey,
            googleModel: process.env.GOOGLE_MODEL || defaults.googleModel,
            cursorPath: process.env.CURSOR_PATH || defaults.cursorPath,
            userName: process.env.USER_NAME || defaults.userName
        };
    }

    /**
     * حفظ الإعدادات إلى ملف .env
     */
    saveSettings(newSettings: Partial<Settings>): boolean {
        try {
            // دمج الإعدادات الجديدة
            this.settings = { ...this.settings, ...newSettings };

            // إنشاء محتوى الملف
            const content = `# ═══════════════════════════════════════════════════════════════
# 🧠 Personal AI Agent - Environment Variables
# ═══════════════════════════════════════════════════════════════

# Server
PORT=${this.settings.port}

# Database
DATABASE_PATH=${this.settings.databasePath}

# Manus MCP Server
MANUS_SERVER_URL=${this.settings.manusServerUrl}
MANUS_API_KEY=${this.settings.manusApiKey}

# OpenAI API
OPENAI_API_KEY=${this.settings.openaiApiKey}
OPENAI_MODEL=${this.settings.openaiModel}

# Google AI (Gemini)
GOOGLE_API_KEY=${this.settings.googleApiKey}
GOOGLE_MODEL=${this.settings.googleModel}

# Cursor
CURSOR_PATH=${this.settings.cursorPath}

# User Info
USER_NAME=${this.settings.userName}
`;

            // كتابة الملف
            fs.writeFileSync(this.envPath, content, 'utf-8');

            // تحديث متغيرات البيئة
            process.env.PORT = String(this.settings.port);
            process.env.DATABASE_PATH = this.settings.databasePath;
            process.env.MANUS_SERVER_URL = this.settings.manusServerUrl;
            process.env.MANUS_API_KEY = this.settings.manusApiKey;
            process.env.OPENAI_API_KEY = this.settings.openaiApiKey;
            process.env.OPENAI_MODEL = this.settings.openaiModel;
            process.env.GOOGLE_API_KEY = this.settings.googleApiKey;
            process.env.GOOGLE_MODEL = this.settings.googleModel;
            process.env.CURSOR_PATH = this.settings.cursorPath;
            process.env.USER_NAME = this.settings.userName;

            return true;
        } catch (error) {
            console.error('❌ Failed to save settings:', error);
            return false;
        }
    }

    /**
     * الحصول على الإعدادات الحالية
     */
    getSettings(): Settings {
        return { ...this.settings };
    }

    /**
     * الحصول على إعدادات آمنة (بدون المفاتيح الكاملة)
     */
    getSafeSettings(): Record<string, any> {
        return {
            port: this.settings.port,
            databasePath: this.settings.databasePath,
            manusServerUrl: this.settings.manusServerUrl,
            manusApiKey: this.maskKey(this.settings.manusApiKey),
            openaiApiKey: this.maskKey(this.settings.openaiApiKey),
            openaiModel: this.settings.openaiModel,
            googleApiKey: this.maskKey(this.settings.googleApiKey),
            googleModel: this.settings.googleModel,
            cursorPath: this.settings.cursorPath,
            userName: this.settings.userName,
            // حالة التكوين
            configured: {
                manus: !!this.settings.manusApiKey,
                openai: !!this.settings.openaiApiKey,
                google: !!this.settings.googleApiKey,
                cursor: !!this.settings.cursorPath
            }
        };
    }

    /**
     * إخفاء جزء من المفتاح
     */
    private maskKey(key: string): string {
        if (!key || key.length < 8) return key ? '***' : '';
        return key.substring(0, 8) + '...' + key.substring(key.length - 4);
    }

    // ═══════════════════════════════════════════════════════════
    // اختبار الاتصال
    // ═══════════════════════════════════════════════════════════

    /**
     * اختبار الاتصال بـ Manus MCP
     */
    async testManus(): Promise<ConnectionTest> {
        const start = Date.now();
        try {
            const response = await fetch(`${this.settings.manusServerUrl}/execute`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.settings.manusApiKey
                },
                body: JSON.stringify({ action: 'ping' })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json() as any;
            return {
                service: 'Manus MCP',
                connected: data.success === true,
                message: data.success ? 'متصل بنجاح' : 'فشل الاتصال',
                latency: Date.now() - start
            };
        } catch (error: any) {
            return {
                service: 'Manus MCP',
                connected: false,
                message: `خطأ: ${error.message}`,
                latency: Date.now() - start
            };
        }
    }

    /**
     * اختبار الاتصال بـ OpenAI
     */
    async testOpenAI(): Promise<ConnectionTest> {
        if (!this.settings.openaiApiKey) {
            return {
                service: 'OpenAI',
                connected: false,
                message: 'مفتاح API غير محدد'
            };
        }

        const start = Date.now();
        try {
            const response = await fetch('https://api.openai.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${this.settings.openaiApiKey}`
                }
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`HTTP ${response.status}: ${error}`);
            }

            return {
                service: 'OpenAI',
                connected: true,
                message: 'متصل بنجاح',
                latency: Date.now() - start
            };
        } catch (error: any) {
            return {
                service: 'OpenAI',
                connected: false,
                message: `خطأ: ${error.message}`,
                latency: Date.now() - start
            };
        }
    }

    /**
     * اختبار الاتصال بـ Google AI
     */
    async testGoogle(): Promise<ConnectionTest> {
        if (!this.settings.googleApiKey) {
            return {
                service: 'Google AI',
                connected: false,
                message: 'مفتاح API غير محدد'
            };
        }

        const start = Date.now();
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models?key=${this.settings.googleApiKey}`
            );

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`HTTP ${response.status}: ${error}`);
            }

            return {
                service: 'Google AI',
                connected: true,
                message: 'متصل بنجاح',
                latency: Date.now() - start
            };
        } catch (error: any) {
            return {
                service: 'Google AI',
                connected: false,
                message: `خطأ: ${error.message}`,
                latency: Date.now() - start
            };
        }
    }

    /**
     * اختبار جميع الاتصالات
     */
    async testAllConnections(): Promise<ConnectionTest[]> {
        const results = await Promise.all([
            this.testManus(),
            this.testOpenAI(),
            this.testGoogle()
        ]);

        return results;
    }
}

// ═══════════════════════════════════════════════════════════════
// Singleton Instance
// ═══════════════════════════════════════════════════════════════

let settingsManager: SettingsManager | null = null;

export function getSettingsManager(): SettingsManager {
    if (!settingsManager) {
        settingsManager = new SettingsManager();
    }
    return settingsManager;
}
