# 🧠 دليل تثبيت الوكيل الشخصي

## المتطلبات

- **Node.js** v18 أو أحدث
- **pnpm** (مدير الحزم)
- **Git**

## خطوات التثبيت

### 1. استنساخ المشروع

```powershell
cd D:\
git clone https://github.com/alabasi2025/personal-ai-agent.git
cd personal-ai-agent
```

### 2. تثبيت التبعيات

```powershell
pnpm install
```

### 3. إعداد ملف البيئة

انسخ ملف `.env.example` إلى `.env`:

```powershell
copy .env.example .env
```

ثم عدّل الملف `.env` وأضف المفاتيح:

```env
# Server
PORT=4000

# Database
DATABASE_PATH=./data/agent.db

# Manus MCP Server
MANUS_SERVER_URL=http://localhost:3000
MANUS_API_KEY=manus-local-3f00b3d8425d22115ce81751e90d5e93

# OpenAI API (اختياري - للمحادثة الذكية)
OPENAI_API_KEY=sk-your-openai-key-here

# Google AI (اختياري)
GOOGLE_API_KEY=
GOOGLE_MODEL=gemini-pro

# User Info
USER_NAME=اسمك
```

### 4. بناء المشروع

```powershell
pnpm build
```

### 5. إنشاء مجلد البيانات

```powershell
mkdir data
```

## التشغيل

### الطريقة 1: استخدام ملف start.bat

```powershell
.\start.bat
```

### الطريقة 2: التشغيل اليدوي

**نافذة 1 - خادم MCP:**
```powershell
node mcp-server.js
```

**نافذة 2 - الوكيل الشخصي:**
```powershell
node dist/server/api.js
```

## الاستخدام

### الواجهة الرسومية

افتح المتصفح على: http://localhost:4000

### API

**إرسال رسالة:**
```powershell
curl -X POST http://localhost:4000/api/chat `
  -H "Content-Type: application/json" `
  -d '{"message": "شغل: dir"}'
```

**حالة النظام:**
```powershell
curl http://localhost:4000/api/status
```

## أمثلة الاستخدام

### تنفيذ أوامر

```
شغل: dir
نفذ: ipconfig
run: npm --version
```

### إدارة الملفات

```
اقرأ الملف: D:\test.txt
أنشئ مجلد: D:\Projects\new-project
```

### Git

```
git status في D:\Projects\my-repo
git pull في D:\Projects\my-repo
```

## استكشاف الأخطاء

### خطأ: لا يمكن الاتصال بـ MCP Server

1. تأكد أن خادم MCP يعمل على المنفذ 3000
2. تحقق من مفتاح API في ملف `.env`

### خطأ: قاعدة البيانات

1. تأكد من وجود مجلد `data`
2. احذف ملف `agent.db` وأعد التشغيل

### خطأ: المنفذ مستخدم

```powershell
# للتحقق من العمليات على المنفذ 4000
netstat -ano | findstr :4000

# لإيقاف العملية
taskkill /PID <process_id> /F
```

## الدعم

للمساعدة أو الإبلاغ عن مشاكل:
https://github.com/alabasi2025/personal-ai-agent/issues
