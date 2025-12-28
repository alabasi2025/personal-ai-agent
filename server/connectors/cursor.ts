/**
 * 💻 Cursor Connector - موصل Cursor AI
 * يتصل بـ Cursor IDE للبرمجة وتعديل الكود
 * 
 * ملاحظة: Cursor لا يملك API رسمي، لذا نستخدم طرق بديلة:
 * 1. تشغيل Cursor عبر CLI
 * 2. التكامل مع VS Code extensions
 * 3. استخدام Cursor Composer عبر automation
 */

import { ManusConnector } from './manus.js';

// ═══════════════════════════════════════════════════════════════
// الأنواع
// ═══════════════════════════════════════════════════════════════

export interface CursorConfig {
    cursorPath?: string;        // مسار Cursor executable
    workspacePath?: string;     // مسار مجلد العمل الافتراضي
    manus: ManusConnector;      // موصل Manus للتنفيذ
}

export interface CodeTask {
    type: 'create' | 'edit' | 'explain' | 'fix' | 'refactor';
    description: string;
    filePath?: string;
    code?: string;
    language?: string;
}

export interface CodeResult {
    success: boolean;
    code?: string;
    filePath?: string;
    explanation?: string;
    error?: string;
}

export interface ProjectInfo {
    name: string;
    path: string;
    files: string[];
    languages: string[];
}

// ═══════════════════════════════════════════════════════════════
// Cursor Connector Class
// ═══════════════════════════════════════════════════════════════

export class CursorConnector {
    private config: CursorConfig;
    private manus: ManusConnector;

    constructor(config: CursorConfig) {
        this.config = {
            cursorPath: 'cursor',  // افتراضي في PATH
            ...config
        };
        this.manus = config.manus;
    }

    // ═══════════════════════════════════════════════════════════
    // فتح Cursor
    // ═══════════════════════════════════════════════════════════

    /**
     * فتح Cursor على مجلد
     */
    async openFolder(folderPath: string): Promise<boolean> {
        try {
            const result = await this.manus.executeCommand(
                `"${this.config.cursorPath}" "${folderPath}"`,
                { timeout: 10000 }
            );
            return result.success;
        } catch (error) {
            console.error('❌ Failed to open Cursor:', error);
            return false;
        }
    }

    /**
     * فتح ملف في Cursor
     */
    async openFile(filePath: string): Promise<boolean> {
        try {
            const result = await this.manus.executeCommand(
                `"${this.config.cursorPath}" "${filePath}"`,
                { timeout: 10000 }
            );
            return result.success;
        } catch (error) {
            console.error('❌ Failed to open file in Cursor:', error);
            return false;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // إنشاء وتعديل الكود
    // ═══════════════════════════════════════════════════════════

    /**
     * إنشاء ملف جديد مع كود
     */
    async createFile(filePath: string, code: string): Promise<CodeResult> {
        try {
            const success = await this.manus.writeFile(filePath, code);
            
            if (success) {
                // فتح الملف في Cursor
                await this.openFile(filePath);
                
                return {
                    success: true,
                    filePath,
                    code
                };
            }

            return {
                success: false,
                error: 'Failed to create file'
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * قراءة ملف
     */
    async readFile(filePath: string): Promise<CodeResult> {
        try {
            const fileInfo = await this.manus.readFile(filePath);
            
            if (fileInfo.exists && fileInfo.content) {
                return {
                    success: true,
                    filePath,
                    code: fileInfo.content
                };
            }

            return {
                success: false,
                error: 'File not found'
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * تعديل ملف
     */
    async editFile(filePath: string, newCode: string): Promise<CodeResult> {
        return this.createFile(filePath, newCode);
    }

    /**
     * إضافة كود لملف موجود
     */
    async appendToFile(filePath: string, code: string): Promise<CodeResult> {
        try {
            const existing = await this.readFile(filePath);
            
            if (existing.success && existing.code) {
                const newCode = existing.code + '\n' + code;
                return this.editFile(filePath, newCode);
            }

            // إذا الملف غير موجود، أنشئه
            return this.createFile(filePath, code);
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ═══════════════════════════════════════════════════════════
    // إدارة المشاريع
    // ═══════════════════════════════════════════════════════════

    /**
     * إنشاء مشروع جديد
     */
    async createProject(projectPath: string, options?: {
        type?: 'node' | 'python' | 'react' | 'next' | 'custom';
        name?: string;
        description?: string;
    }): Promise<CodeResult> {
        try {
            // إنشاء المجلد
            await this.manus.createDirectory(projectPath);

            // إنشاء ملفات أساسية حسب النوع
            const type = options?.type || 'node';
            
            if (type === 'node') {
                // package.json
                const packageJson = {
                    name: options?.name || 'my-project',
                    version: '1.0.0',
                    description: options?.description || '',
                    main: 'index.js',
                    scripts: {
                        start: 'node index.js',
                        dev: 'node --watch index.js'
                    }
                };
                await this.manus.writeFile(
                    `${projectPath}/package.json`,
                    JSON.stringify(packageJson, null, 2)
                );

                // index.js
                await this.manus.writeFile(
                    `${projectPath}/index.js`,
                    '// Entry point\nconsole.log("Hello, World!");\n'
                );

            } else if (type === 'python') {
                // main.py
                await this.manus.writeFile(
                    `${projectPath}/main.py`,
                    '# Entry point\n\ndef main():\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    main()\n'
                );

                // requirements.txt
                await this.manus.writeFile(
                    `${projectPath}/requirements.txt`,
                    '# Add your dependencies here\n'
                );
            }

            // README.md
            await this.manus.writeFile(
                `${projectPath}/README.md`,
                `# ${options?.name || 'My Project'}\n\n${options?.description || 'A new project'}\n`
            );

            // .gitignore
            await this.manus.writeFile(
                `${projectPath}/.gitignore`,
                'node_modules/\n__pycache__/\n.env\n*.log\n'
            );

            // فتح المشروع في Cursor
            await this.openFolder(projectPath);

            return {
                success: true,
                filePath: projectPath,
                explanation: `تم إنشاء مشروع ${type} في ${projectPath}`
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * معلومات المشروع
     */
    async getProjectInfo(projectPath: string): Promise<ProjectInfo | null> {
        try {
            const files = await this.manus.listDirectory(projectPath);
            
            // تحديد اللغات
            const languages = new Set<string>();
            for (const file of files) {
                if (file.endsWith('.js') || file.endsWith('.ts')) languages.add('JavaScript/TypeScript');
                if (file.endsWith('.py')) languages.add('Python');
                if (file.endsWith('.java')) languages.add('Java');
                if (file.endsWith('.go')) languages.add('Go');
                if (file.endsWith('.rs')) languages.add('Rust');
            }

            // اسم المشروع من package.json أو المجلد
            let name = projectPath.split(/[/\\]/).pop() || 'Unknown';
            
            const packageJson = await this.manus.readFile(`${projectPath}/package.json`);
            if (packageJson.exists && packageJson.content) {
                try {
                    const pkg = JSON.parse(packageJson.content);
                    name = pkg.name || name;
                } catch {}
            }

            return {
                name,
                path: projectPath,
                files,
                languages: Array.from(languages)
            };
        } catch (error) {
            console.error('❌ Failed to get project info:', error);
            return null;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // تشغيل الأوامر
    // ═══════════════════════════════════════════════════════════

    /**
     * تشغيل npm/pnpm command
     */
    async runNpm(command: string, projectPath: string): Promise<CodeResult> {
        try {
            const result = await this.manus.executeCommand(
                `cd "${projectPath}" && pnpm ${command}`,
                { timeout: 120000 }
            );

            return {
                success: result.success,
                explanation: result.output,
                error: result.error
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * تشغيل Python command
     */
    async runPython(command: string, projectPath: string): Promise<CodeResult> {
        try {
            const result = await this.manus.executeCommand(
                `cd "${projectPath}" && python ${command}`,
                { timeout: 120000 }
            );

            return {
                success: result.success,
                explanation: result.output,
                error: result.error
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * تثبيت dependencies
     */
    async installDependencies(projectPath: string, packages?: string[]): Promise<CodeResult> {
        try {
            let command = 'install';
            if (packages && packages.length > 0) {
                command = `add ${packages.join(' ')}`;
            }

            return this.runNpm(command, projectPath);
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Git Integration
    // ═══════════════════════════════════════════════════════════

    /**
     * Git init
     */
    async gitInit(projectPath: string): Promise<CodeResult> {
        try {
            const result = await this.manus.gitCommand('init', projectPath);
            return {
                success: result.success,
                explanation: result.output,
                error: result.error
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Git commit
     */
    async gitCommit(projectPath: string, message: string): Promise<CodeResult> {
        try {
            await this.manus.gitCommand('add .', projectPath);
            const result = await this.manus.gitCommand(`commit -m "${message}"`, projectPath);
            return {
                success: result.success,
                explanation: result.output,
                error: result.error
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ═══════════════════════════════════════════════════════════
    // الحالة
    // ═══════════════════════════════════════════════════════════

    /**
     * معلومات الموصل
     */
    getInfo(): { name: string; cursorPath: string; workspacePath?: string } {
        return {
            name: 'Cursor AI',
            cursorPath: this.config.cursorPath!,
            workspacePath: this.config.workspacePath
        };
    }
}

// ═══════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════

export function createCursorConnector(manus: ManusConnector, cursorPath?: string): CursorConnector {
    return new CursorConnector({
        manus,
        cursorPath: cursorPath || 'cursor'
    });
}
