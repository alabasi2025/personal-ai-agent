# 🧠 Personal AI Agent - وكيلك الشخصي

وكيل ذكي شخصي يجمع قوة **Manus + Cursor Ultra + Google AI Ultra** في مكان واحد مع ذاكرة دائمة.

## ✨ المميزات

- 🧠 **ذاكرة دائمة** - يحفظ كل محادثاتك ومشاريعك وتفضيلاتك
- 🤖 **توزيع ذكي** - يختار الأداة المناسبة تلقائياً
- ⚡ **Manus** - تنفيذ أوامر، إدارة ملفات، Git
- 💻 **Cursor** - برمجة، تعديل كود، إنشاء مشاريع
- 🔍 **Google AI** - تحليل، بحث، محادثة ذكية
- 🌐 **واجهة ويب** - جميلة وسهلة الاستخدام

## 📋 المتطلبات

- Node.js 18+
- pnpm
- Windows 10/11

## 🚀 التثبيت

### 1. استنساخ المشروع

```bash
git clone https://github.com/alabasi2025/personal-ai-agent.git
cd personal-ai-agent
```

### 2. تثبيت الـ dependencies

```bash
pnpm install
```

### 3. إعداد ملف البيئة

```bash
copy .env.example .env
```

ثم عدّل `.env` بمعلوماتك:

```env
# Manus MCP Server
MANUS_SERVER_URL=http://localhost:3000
MANUS_API_KEY=your-manus-api-key

# Google AI
GOOGLE_API_KEY=your-google-api-key

# اختياري
CURSOR_PATH=C:\Users\qbas\AppData\Local\Programs\cursor\Cursor.exe
USER_NAME=اسمك
```

### 4. البناء والتشغيل

```bash
pnpm build
pnpm start
```

أو استخدم:

```bash
start.bat
```

### 5. فتح الواجهة

افتح المتصفح على:

```
http://localhost:4000
```

## 📚 API Endpoints

| Endpoint | Method | الوصف |
|----------|--------|-------|
| `/api/chat` | POST | إرسال رسالة |
| `/api/status` | GET | حالة الوكيل |
| `/api/conversations` | GET | المحادثات |
| `/api/conversations/new` | POST | محادثة جديدة |
| `/api/memory` | GET | الذاكرة |
| `/api/memory/remember` | POST | تذكر معلومة |
| `/api/memory/recall/:key` | GET | استرجاع معلومة |
| `/api/projects` | GET | المشاريع |
| `/api/projects` | POST | تسجيل مشروع |
| `/api/execute/:tool` | POST | تنفيذ مع أداة محددة |

## 💬 أمثلة الاستخدام

### محادثة عادية

```bash
curl -X POST http://localhost:4000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "ما هو الذكاء الاصطناعي؟"}'
```

### تنفيذ أمر (Manus)

```bash
curl -X POST http://localhost:4000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "شغل: dir D:\\Projects", "forceTool": "manus"}'
```

### كتابة كود (Cursor)

```bash
curl -X POST http://localhost:4000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "اكتب دالة JavaScript لحساب المضروب", "forceTool": "cursor"}'
```

### تذكر معلومة

```bash
curl -X POST http://localhost:4000/api/memory/remember \
  -H "Content-Type: application/json" \
  -d '{"key": "favorite_language", "value": "TypeScript"}'
```

## 🏗️ البنية

```
personal-ai-agent/
├── server/
│   ├── api.ts              # خادم API
│   ├── core/
│   │   ├── agent.ts        # الوكيل الرئيسي
│   │   └── router.ts       # موزع المهام
│   ├── connectors/
│   │   ├── manus.ts        # موصل Manus
│   │   ├── google.ts       # موصل Google AI
│   │   └── cursor.ts       # موصل Cursor
│   └── memory/
│       ├── database.ts     # إدارة قاعدة البيانات
│       └── store.ts        # نظام الذاكرة
├── public/
│   └── index.html          # واجهة المستخدم
├── database/
│   └── schema.sql          # هيكل قاعدة البيانات
├── data/                   # بيانات الوكيل (SQLite)
├── .env                    # الإعدادات
├── package.json
└── tsconfig.json
```

## 🔧 التطوير

```bash
# تشغيل في وضع التطوير
pnpm dev

# بناء المشروع
pnpm build

# تشغيل الإنتاج
pnpm start
```

## 📄 الترخيص

MIT License

## 👤 المؤلف

تم تطويره بواسطة **Manus AI** لـ **alabasi2025**

---

**🎉 استمتع بوكيلك الشخصي!**
