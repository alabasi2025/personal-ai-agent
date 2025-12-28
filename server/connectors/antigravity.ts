/**
 * 🚀 Antigravity Connector - موصل Antigravity
 * يتصل بـ Antigravity IDE للبرمجة والتطوير
 */

import { ManusConnector } from './manus.js';

// ═══════════════════════════════════════════════════════════════
// الأنواع
// ═══════════════════════════════════════════════════════════════

export interface AntigravityConfig {
    antigravityPath: string;
    manus: ManusConnector;
}

// ═══════════════════════════════════════════════════════════════
// Antigravity Connector Class
// ═══════════════════════════════════════════════════════════════

export class AntigravityConnector {
    private config: AntigravityConfig;
    private isConnected: boolean = false;

    constructor(config: AntigravityConfig) {
        this.config = config;
    }

    // ═══════════════════════════════════════════════════════════
    // الاتصال
    // ═══════════════════════════════════════════════════════════

    /**
     * التحقق من وجود Antigravity
     */
    async connect(): Promise<boolean> {
        try {
            const result = await this.config.manus.executeCommand(
                `if exist "${this.config.antigravityPath}" (echo exists) else (echo not found)`
            );
            
            this.isConnected = result.success && result.output?.includes('exists');
            return this.isConnected;
        } catch (error) {
            console.error('❌ Failed to connect to Antigravity:', error);
            this.isConnected = false;
            return false;
        }
    }

    /**
     * فتح Antigravity
     */
    async open(projectPath?: string): Promise<boolean> {
        if (!this.isConnected) {
            throw new Error('Antigravity is not connected');
        }

        try {
            const command = projectPath
                ? `start "" "${this.config.antigravityPath}" "${projectPath}"`
                : `start "" "${this.config.antigravityPath}"`;

            const result = await this.config.manus.executeCommand(command);
            return result.success;
        } catch (error) {
            console.error('❌ Failed to open Antigravity:', error);
            return false;
        }
    }

    /**
     * فتح ملف في Antigravity
     */
    async openFile(filePath: string): Promise<boolean> {
        if (!this.isConnected) {
            throw new Error('Antigravity is not connected');
        }

        try {
            const command = `start "" "${this.config.antigravityPath}" "${filePath}"`;
            const result = await this.config.manus.executeCommand(command);
            return result.success;
        } catch (error) {
            console.error('❌ Failed to open file in Antigravity:', error);
            return false;
        }
    }

    /**
     * الحصول على حالة الاتصال
     */
    getConnectionStatus() {
        return {
            name: 'Antigravity IDE',
            antigravityPath: this.config.antigravityPath,
            connected: this.isConnected
        };
    }
}

// ═══════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════

export function createAntigravityConnector(
    manus: ManusConnector,
    antigravityPath: string = 'C:\\Users\\qbas\\AppData\\Local\\Programs\\Antigravity\\Antigravity.exe'
): AntigravityConnector {
    return new AntigravityConnector({
        antigravityPath,
        manus
    });
}
