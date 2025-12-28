/**
 * 🌟 Google AI Connector - موصل Google AI
 * يتصل بـ Gemini API و Google AI Ultra
 */

import { GoogleGenerativeAI, GenerativeModel, Content, Part } from '@google/generative-ai';

// ═══════════════════════════════════════════════════════════════
// الأنواع
// ═══════════════════════════════════════════════════════════════

export interface GoogleAIConfig {
    apiKey: string;
    model?: string;          // gemini-pro, gemini-pro-vision, etc.
    maxTokens?: number;
    temperature?: number;
}

export interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}

export interface ChatResponse {
    success: boolean;
    content?: string;
    error?: string;
    tokensUsed?: number;
    model?: string;
}

export interface AnalysisResult {
    success: boolean;
    analysis?: string;
    summary?: string;
    keyPoints?: string[];
    error?: string;
}

// ═══════════════════════════════════════════════════════════════
// Google AI Connector Class
// ═══════════════════════════════════════════════════════════════

export class GoogleAIConnector {
    private genAI: GoogleGenerativeAI;
    private model: GenerativeModel;
    private config: GoogleAIConfig;
    private chatHistory: Content[] = [];

    constructor(config: GoogleAIConfig) {
        this.config = {
            model: 'gemini-pro',
            maxTokens: 8192,
            temperature: 0.7,
            ...config
        };

        this.genAI = new GoogleGenerativeAI(this.config.apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: this.config.model!,
            generationConfig: {
                maxOutputTokens: this.config.maxTokens,
                temperature: this.config.temperature
            }
        });
    }

    // ═══════════════════════════════════════════════════════════
    // المحادثة
    // ═══════════════════════════════════════════════════════════

    /**
     * إرسال رسالة واحدة
     */
    async chat(message: string, systemPrompt?: string): Promise<ChatResponse> {
        try {
            let prompt = message;
            
            if (systemPrompt) {
                prompt = `${systemPrompt}\n\n---\n\n${message}`;
            }

            const result = await this.model.generateContent(prompt);
            const response = result.response;
            const text = response.text();

            return {
                success: true,
                content: text,
                model: this.config.model
            };
        } catch (error: any) {
            console.error('❌ Google AI chat error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * محادثة متعددة الرسائل
     */
    async chatWithHistory(messages: ChatMessage[], systemPrompt?: string): Promise<ChatResponse> {
        try {
            // تحويل الرسائل لصيغة Gemini
            const contents: Content[] = messages.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            }));

            // إضافة system prompt كأول رسالة
            if (systemPrompt) {
                contents.unshift({
                    role: 'user',
                    parts: [{ text: `[System Instructions]\n${systemPrompt}\n[End System Instructions]` }]
                });
                contents.splice(1, 0, {
                    role: 'model',
                    parts: [{ text: 'فهمت التعليمات. سأتبعها.' }]
                });
            }

            const chat = this.model.startChat({
                history: contents.slice(0, -1)
            });

            const lastMessage = contents[contents.length - 1];
            const result = await chat.sendMessage(lastMessage.parts[0].text || '');
            const response = result.response;
            const text = response.text();

            return {
                success: true,
                content: text,
                model: this.config.model
            };
        } catch (error: any) {
            console.error('❌ Google AI chat with history error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * بدء محادثة جديدة
     */
    startNewChat(): void {
        this.chatHistory = [];
    }

    // ═══════════════════════════════════════════════════════════
    // التحليل
    // ═══════════════════════════════════════════════════════════

    /**
     * تحليل نص
     */
    async analyzeText(text: string, instructions?: string): Promise<AnalysisResult> {
        try {
            const prompt = `
${instructions || 'حلل النص التالي وقدم ملخصاً والنقاط الرئيسية:'}

النص:
---
${text}
---

قدم التحليل بالصيغة التالية:
## الملخص
[ملخص موجز]

## النقاط الرئيسية
- نقطة 1
- نقطة 2
- نقطة 3

## التحليل التفصيلي
[التحليل]
`;

            const result = await this.model.generateContent(prompt);
            const response = result.response.text();

            // استخراج الأقسام
            const summaryMatch = response.match(/## الملخص\n([\s\S]*?)(?=##|$)/);
            const pointsMatch = response.match(/## النقاط الرئيسية\n([\s\S]*?)(?=##|$)/);

            const keyPoints = pointsMatch
                ? pointsMatch[1].split('\n').filter(line => line.trim().startsWith('-')).map(line => line.trim().substring(1).trim())
                : [];

            return {
                success: true,
                analysis: response,
                summary: summaryMatch ? summaryMatch[1].trim() : undefined,
                keyPoints
            };
        } catch (error: any) {
            console.error('❌ Google AI analyze error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * تحليل مهمة وتحديد الأداة المناسبة
     */
    async analyzeTask(task: string): Promise<{
        needsExecution: boolean;
        needsCoding: boolean;
        needsAnalysis: boolean;
        needsResearch: boolean;
        suggestedTool: 'manus' | 'cursor' | 'google';
        reasoning: string;
    }> {
        try {
            const prompt = `
أنت محلل مهام ذكي. حلل المهمة التالية وحدد نوعها والأداة المناسبة لها.

المهمة: "${task}"

الأدوات المتاحة:
1. **manus** - للتنفيذ على الجهاز (أوامر shell، إدارة ملفات، git، تشغيل برامج)
2. **cursor** - للبرمجة وتعديل الكود (إنشاء مشاريع، كتابة كود، تعديل ملفات برمجية)
3. **google** - للتحليل والبحث والمحادثة (أسئلة، تحليل، بحث، شرح)

أجب بصيغة JSON فقط:
{
    "needsExecution": true/false,
    "needsCoding": true/false,
    "needsAnalysis": true/false,
    "needsResearch": true/false,
    "suggestedTool": "manus" أو "cursor" أو "google",
    "reasoning": "السبب"
}
`;

            const result = await this.model.generateContent(prompt);
            const response = result.response.text();

            // استخراج JSON
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            // افتراضي
            return {
                needsExecution: false,
                needsCoding: false,
                needsAnalysis: true,
                needsResearch: false,
                suggestedTool: 'google',
                reasoning: 'لم يتم تحديد نوع المهمة بوضوح'
            };
        } catch (error: any) {
            console.error('❌ Google AI task analysis error:', error);
            return {
                needsExecution: false,
                needsCoding: false,
                needsAnalysis: true,
                needsResearch: false,
                suggestedTool: 'google',
                reasoning: error.message
            };
        }
    }

    // ═══════════════════════════════════════════════════════════
    // توليد المحتوى
    // ═══════════════════════════════════════════════════════════

    /**
     * توليد كود
     */
    async generateCode(description: string, language: string): Promise<ChatResponse> {
        const prompt = `
أنت مبرمج خبير. اكتب كود ${language} للمهمة التالية:

${description}

قواعد:
- اكتب كود نظيف وقابل للقراءة
- أضف تعليقات توضيحية
- اتبع أفضل الممارسات
- الكود يجب أن يكون جاهزاً للتشغيل

أعد الكود فقط بدون شرح إضافي، داخل block كود:
\`\`\`${language}
// الكود هنا
\`\`\`
`;

        return this.chat(prompt);
    }

    /**
     * تلخيص نص
     */
    async summarize(text: string, maxLength?: number): Promise<ChatResponse> {
        const prompt = `
لخص النص التالي ${maxLength ? `في حدود ${maxLength} كلمة` : 'بشكل موجز'}:

${text}
`;

        return this.chat(prompt);
    }

    /**
     * ترجمة نص
     */
    async translate(text: string, targetLanguage: string): Promise<ChatResponse> {
        const prompt = `ترجم النص التالي إلى ${targetLanguage}:\n\n${text}`;
        return this.chat(prompt);
    }

    // ═══════════════════════════════════════════════════════════
    // الإعدادات
    // ═══════════════════════════════════════════════════════════

    /**
     * تغيير النموذج
     */
    setModel(modelName: string): void {
        this.config.model = modelName;
        this.model = this.genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                maxOutputTokens: this.config.maxTokens,
                temperature: this.config.temperature
            }
        });
    }

    /**
     * تغيير درجة الحرارة
     */
    setTemperature(temperature: number): void {
        this.config.temperature = temperature;
        this.model = this.genAI.getGenerativeModel({
            model: this.config.model!,
            generationConfig: {
                maxOutputTokens: this.config.maxTokens,
                temperature
            }
        });
    }

    /**
     * معلومات الموصل
     */
    getInfo(): { name: string; model: string; temperature: number } {
        return {
            name: 'Google AI (Gemini)',
            model: this.config.model!,
            temperature: this.config.temperature!
        };
    }
}

// ═══════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════

export function createGoogleAIConnector(apiKey: string, model?: string): GoogleAIConnector {
    return new GoogleAIConnector({
        apiKey,
        model: model || 'gemini-pro'
    });
}
