/**
 * 🤖 Manus Connector - موصل Manus
 * يتصل بـ Manus MCP Server للتنفيذ على الجهاز المحلي
 */

import { ToolLog } from '../memory/database.js';

// ═══════════════════════════════════════════════════════════════
// الأنواع
// ═══════════════════════════════════════════════════════════════

export interface ManusConfig {
    serverUrl: string;      // عنوان MCP Server
    apiKey?: string;        // مفتاح API (اختياري)
    timeout?: number;       // مهلة الانتظار بالمللي ثانية
}

export interface CommandResult {
    success: boolean;
    output?: string;
    error?: string;
    exitCode?: number;
    duration?: number;
}

export interface FileInfo {
    path: string;
    content?: string;
    exists: boolean;
    isDirectory?: boolean;
    size?: number;
    modified?: string;
}

export interface TaskInfo {
    taskId: string;
    status: 'running' | 'completed' | 'failed';
    output?: string;
    error?: string;
}

// ═══════════════════════════════════════════════════════════════
// Manus Connector Class
// ═══════════════════════════════════════════════════════════════

export class ManusConnector {
    private config: ManusConfig;
    private isConnected: boolean = false;

    constructor(config: ManusConfig) {
        this.config = {
            timeout: 30000,
            ...config
        };
    }

    // ═══════════════════════════════════════════════════════════
    // الاتصال
    // ═══════════════════════════════════════════════════════════

    /**
     * التحقق من الاتصال بـ MCP Server
     */
    async connect(): Promise<boolean> {
        try {
            const response = await this.request('ping', {});
            this.isConnected = response.success;
            return this.isConnected;
        } catch (error) {
            console.error('❌ Failed to connect to Manus MCP Server:', error);
            this.isConnected = false;
            return false;
        }
    }

    /**
     * إرسال طلب للـ MCP Server
     */
    private async request(action: string, params: Record<string, any>): Promise<any> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeout);

        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };

            if (this.config.apiKey) {
                headers['X-API-Key'] = this.config.apiKey;
            }

            const response = await fetch(`${this.config.serverUrl}/execute`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ action, ...params }),
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error: any) {
            clearTimeout(timeout);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // تنفيذ الأوامر
    // ═══════════════════════════════════════════════════════════

    /**
     * تنفيذ أمر Shell
     */
    async executeCommand(command: string, options?: {
        cwd?: string;
        timeout?: number;
    }): Promise<CommandResult> {
        const startTime = Date.now();

        try {
            const result = await this.request('execute_command', {
                command,
                cwd: options?.cwd,
                timeout: options?.timeout
            });

            return {
                success: result.success !== false,
                output: result.output || result.stdout,
                error: result.error || result.stderr,
                exitCode: result.exitCode,
                duration: Date.now() - startTime
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message,
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * تشغيل مهمة طويلة في الخلفية
     */
    async startTask(command: string, options?: {
        cwd?: string;
        name?: string;
    }): Promise<TaskInfo> {
        try {
            const result = await this.request('start_task', {
                command,
                cwd: options?.cwd,
                name: options?.name
            });

            return {
                taskId: result.taskId,
                status: 'running'
            };
        } catch (error: any) {
            return {
                taskId: '',
                status: 'failed',
                error: error.message
            };
        }
    }

    /**
     * التحقق من حالة مهمة
     */
    async getTaskStatus(taskId: string): Promise<TaskInfo> {
        try {
            const result = await this.request('get_task_status', { taskId });

            return {
                taskId,
                status: result.status,
                output: result.output,
                error: result.error
            };
        } catch (error: any) {
            return {
                taskId,
                status: 'failed',
                error: error.message
            };
        }
    }

    // ═══════════════════════════════════════════════════════════
    // إدارة الملفات
    // ═══════════════════════════════════════════════════════════

    /**
     * قراءة ملف
     */
    async readFile(filePath: string): Promise<FileInfo> {
        try {
            const result = await this.request('read_file', { path: filePath });

            return {
                path: filePath,
                content: result.content,
                exists: true,
                size: result.size,
                modified: result.modified
            };
        } catch (error: any) {
            return {
                path: filePath,
                exists: false
            };
        }
    }

    /**
     * كتابة ملف
     */
    async writeFile(filePath: string, content: string): Promise<boolean> {
        try {
            const result = await this.request('write_file', {
                path: filePath,
                content
            });

            return result.success !== false;
        } catch (error) {
            console.error('❌ Failed to write file:', error);
            return false;
        }
    }

    /**
     * قائمة محتويات مجلد
     */
    async listDirectory(dirPath: string): Promise<string[]> {
        try {
            const result = await this.request('list_directory_contents', {
                path: dirPath
            });

            return result.contents || result.files || [];
        } catch (error) {
            console.error('❌ Failed to list directory:', error);
            return [];
        }
    }

    /**
     * إنشاء مجلد
     */
    async createDirectory(dirPath: string): Promise<boolean> {
        try {
            const result = await this.request('create_directory', {
                path: dirPath
            });

            return result.success !== false;
        } catch (error) {
            console.error('❌ Failed to create directory:', error);
            return false;
        }
    }

    /**
     * حذف ملف أو مجلد
     */
    async delete(path: string): Promise<boolean> {
        try {
            const result = await this.request('delete', { path });
            return result.success !== false;
        } catch (error) {
            console.error('❌ Failed to delete:', error);
            return false;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Git Operations
    // ═══════════════════════════════════════════════════════════

    /**
     * تنفيذ أمر Git
     */
    async gitCommand(command: string, repoPath: string): Promise<CommandResult> {
        return this.executeCommand(`git ${command}`, { cwd: repoPath });
    }

    /**
     * Git Pull
     */
    async gitPull(repoPath: string): Promise<CommandResult> {
        return this.gitCommand('pull', repoPath);
    }

    /**
     * Git Push
     */
    async gitPush(repoPath: string): Promise<CommandResult> {
        return this.gitCommand('push', repoPath);
    }

    /**
     * Git Status
     */
    async gitStatus(repoPath: string): Promise<CommandResult> {
        return this.gitCommand('status', repoPath);
    }

    // ═══════════════════════════════════════════════════════════
    // معلومات النظام
    // ═══════════════════════════════════════════════════════════

    /**
     * معلومات النظام
     */
    async getSystemInfo(): Promise<Record<string, any>> {
        try {
            const result = await this.request('system_info', {});
            return result;
        } catch (error) {
            console.error('❌ Failed to get system info:', error);
            return {};
        }
    }

    /**
     * قائمة العمليات الجارية
     */
    async listProcesses(): Promise<any[]> {
        try {
            const result = await this.request('list_processes', {});
            return result.processes || [];
        } catch (error) {
            console.error('❌ Failed to list processes:', error);
            return [];
        }
    }

    // ═══════════════════════════════════════════════════════════
    // الحالة
    // ═══════════════════════════════════════════════════════════

    /**
     * هل متصل؟
     */
    get connected(): boolean {
        return this.isConnected;
    }

    /**
     * معلومات الموصل
     */
    getInfo(): { name: string; serverUrl: string; connected: boolean } {
        return {
            name: 'Manus MCP',
            serverUrl: this.config.serverUrl,
            connected: this.isConnected
        };
    }
}

// ═══════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════

export function createManusConnector(serverUrl: string, apiKey?: string): ManusConnector {
    return new ManusConnector({
        serverUrl,
        apiKey
    });
}
