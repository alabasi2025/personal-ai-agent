/**
 * 🖥️ Manus MCP Server - خادم MCP محلي
 * يوفر واجهة للتنفيذ على الجهاز المحلي
 */

const http = require('http');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ═══════════════════════════════════════════════════════════════
// الإعدادات
// ═══════════════════════════════════════════════════════════════

const PORT = process.env.MCP_PORT || 3000;
const API_KEY = process.env.MCP_API_KEY || 'manus-local-3f00b3d8425d22115ce81751e90d5e93';

// المهام الجارية
const runningTasks = new Map();
let taskIdCounter = 0;

// ═══════════════════════════════════════════════════════════════
// الدوال المساعدة
// ═══════════════════════════════════════════════════════════════

function generateTaskId() {
    return `task_${++taskIdCounter}_${Date.now()}`;
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(JSON.parse(body || '{}'));
            } catch (e) {
                resolve({});
            }
        });
        req.on('error', reject);
    });
}

function sendResponse(res, data, statusCode = 200) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
    });
    res.end(JSON.stringify(data));
}

function sendError(res, message, statusCode = 400) {
    sendResponse(res, { success: false, error: message }, statusCode);
}

// ═══════════════════════════════════════════════════════════════
// التحقق من المصادقة
// ═══════════════════════════════════════════════════════════════

function authenticate(req) {
    const apiKey = req.headers['x-api-key'];
    return apiKey === API_KEY;
}

// ═══════════════════════════════════════════════════════════════
// الإجراءات
// ═══════════════════════════════════════════════════════════════

const actions = {
    // Ping للتحقق من الاتصال
    ping: async () => {
        return { success: true, message: 'pong', timestamp: new Date().toISOString() };
    },

    // تنفيذ أمر
    execute_command: async (params) => {
        const { command, cwd, timeout = 30000 } = params;
        
        if (!command) {
            return { success: false, error: 'الأمر مطلوب' };
        }

        return new Promise((resolve) => {
            const options = {
                cwd: cwd || process.cwd(),
                timeout,
                maxBuffer: 10 * 1024 * 1024 // 10MB
            };

            exec(command, options, (error, stdout, stderr) => {
                resolve({
                    success: !error,
                    output: stdout,
                    error: stderr || (error ? error.message : null),
                    exitCode: error ? error.code : 0
                });
            });
        });
    },

    // بدء مهمة في الخلفية
    start_task: async (params) => {
        const { command, cwd, name } = params;
        
        if (!command) {
            return { success: false, error: 'الأمر مطلوب' };
        }

        const taskId = generateTaskId();
        const parts = command.split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);

        const child = spawn(cmd, args, {
            cwd: cwd || process.cwd(),
            shell: true,
            detached: true
        });

        let output = '';
        let errorOutput = '';

        child.stdout.on('data', (data) => {
            output += data.toString();
        });

        child.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        runningTasks.set(taskId, {
            name: name || command,
            process: child,
            status: 'running',
            output: () => output,
            error: () => errorOutput,
            startTime: new Date()
        });

        child.on('close', (code) => {
            const task = runningTasks.get(taskId);
            if (task) {
                task.status = code === 0 ? 'completed' : 'failed';
                task.exitCode = code;
            }
        });

        return { success: true, taskId, status: 'running' };
    },

    // حالة المهمة
    get_task_status: async (params) => {
        const { taskId } = params;
        const task = runningTasks.get(taskId);

        if (!task) {
            return { success: false, error: 'المهمة غير موجودة' };
        }

        return {
            success: true,
            taskId,
            name: task.name,
            status: task.status,
            output: task.output(),
            error: task.error(),
            exitCode: task.exitCode,
            startTime: task.startTime
        };
    },

    // قراءة ملف
    read_file: async (params) => {
        const { path: filePath } = params;
        
        if (!filePath) {
            return { success: false, error: 'المسار مطلوب' };
        }

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const stats = fs.statSync(filePath);
            
            return {
                success: true,
                content,
                size: stats.size,
                modified: stats.mtime.toISOString()
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // كتابة ملف
    write_file: async (params) => {
        const { path: filePath, content } = params;
        
        if (!filePath) {
            return { success: false, error: 'المسار مطلوب' };
        }

        try {
            // إنشاء المجلدات إذا لم تكن موجودة
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(filePath, content || '', 'utf-8');
            return { success: true, message: 'تم كتابة الملف' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // قائمة محتويات مجلد
    list_directory_contents: async (params) => {
        const { path: dirPath } = params;
        
        if (!dirPath) {
            return { success: false, error: 'المسار مطلوب' };
        }

        try {
            const contents = fs.readdirSync(dirPath);
            const detailed = contents.map(item => {
                const fullPath = path.join(dirPath, item);
                try {
                    const stats = fs.statSync(fullPath);
                    return {
                        name: item,
                        isDirectory: stats.isDirectory(),
                        size: stats.size,
                        modified: stats.mtime.toISOString()
                    };
                } catch {
                    return { name: item, error: 'لا يمكن قراءة المعلومات' };
                }
            });

            return { success: true, contents: detailed };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // إنشاء مجلد
    create_directory: async (params) => {
        const { path: dirPath } = params;
        
        if (!dirPath) {
            return { success: false, error: 'المسار مطلوب' };
        }

        try {
            fs.mkdirSync(dirPath, { recursive: true });
            return { success: true, message: 'تم إنشاء المجلد' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // حذف ملف أو مجلد
    delete: async (params) => {
        const { path: targetPath } = params;
        
        if (!targetPath) {
            return { success: false, error: 'المسار مطلوب' };
        }

        try {
            const stats = fs.statSync(targetPath);
            if (stats.isDirectory()) {
                fs.rmSync(targetPath, { recursive: true });
            } else {
                fs.unlinkSync(targetPath);
            }
            return { success: true, message: 'تم الحذف' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // معلومات النظام
    system_info: async () => {
        return {
            success: true,
            platform: os.platform(),
            arch: os.arch(),
            hostname: os.hostname(),
            cpus: os.cpus().length,
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            uptime: os.uptime(),
            homeDir: os.homedir(),
            tempDir: os.tmpdir()
        };
    },

    // قائمة العمليات
    list_processes: async () => {
        const tasks = [];
        for (const [id, task] of runningTasks) {
            tasks.push({
                taskId: id,
                name: task.name,
                status: task.status,
                startTime: task.startTime
            });
        }
        return { success: true, processes: tasks };
    }
};

// ═══════════════════════════════════════════════════════════════
// الخادم
// ═══════════════════════════════════════════════════════════════

const server = http.createServer(async (req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
        });
        res.end();
        return;
    }

    // Health check
    if (req.url === '/health' && req.method === 'GET') {
        return sendResponse(res, { status: 'ok', timestamp: new Date().toISOString() });
    }

    // الصفحة الرئيسية
    if (req.url === '/' && req.method === 'GET') {
        return sendResponse(res, {
            name: '🖥️ Manus MCP Server',
            version: '1.0.0',
            status: 'running',
            endpoints: {
                execute: 'POST /execute',
                health: 'GET /health'
            }
        });
    }

    // التنفيذ
    if (req.url === '/execute' && req.method === 'POST') {
        // التحقق من المصادقة
        if (!authenticate(req)) {
            return sendError(res, 'Unauthorized', 401);
        }

        try {
            const body = await parseBody(req);
            const { action, ...params } = body;

            if (!action) {
                return sendError(res, 'الإجراء مطلوب');
            }

            const handler = actions[action];
            if (!handler) {
                return sendError(res, `الإجراء غير معروف: ${action}`);
            }

            const result = await handler(params);
            return sendResponse(res, result);
        } catch (error) {
            return sendError(res, error.message, 500);
        }
    }

    // 404
    sendError(res, 'Not Found', 404);
});

// ═══════════════════════════════════════════════════════════════
// التشغيل
// ═══════════════════════════════════════════════════════════════

server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║           🖥️ Manus MCP Server                              ║
╠════════════════════════════════════════════════════════════╣
║  🌐 Server: http://localhost:${PORT}                         ║
║  🔑 API Key: ${API_KEY.substring(0, 20)}...                  ║
╠════════════════════════════════════════════════════════════╣
║  Actions:                                                  ║
║  • ping                  - التحقق من الاتصال              ║
║  • execute_command       - تنفيذ أمر                      ║
║  • start_task           - بدء مهمة في الخلفية             ║
║  • read_file            - قراءة ملف                       ║
║  • write_file           - كتابة ملف                       ║
║  • list_directory_contents - قائمة المجلد                 ║
║  • system_info          - معلومات النظام                  ║
╚════════════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 جاري إغلاق الخادم...');
    server.close();
    process.exit(0);
});
