# دليل رفع نظام حجز مواعيد الفحص الفني

## نتائج الاختبار ✅

| الاختبار | النتيجة |
|---|---|
| بناء الكود (pnpm build) | ✅ نجح |
| TypeScript (pnpm check) | ✅ بدون أخطاء |
| الاختبارات (pnpm test) | ✅ 11/11 نجحت |
| تشغيل وضع الإنتاج | ✅ يعمل |
| API الرئيسي (/api/trpc) | ✅ يستجيب |
| صفحة الحجز (/booking) | ✅ تعمل |
| لوحة التحكم (/admin) | ✅ تعمل |
| Site API (/data) | ✅ يستجيب |

---

## الطريقة الأولى: Railway (الأسهل والأسرع) 🚂

### الخطوات:

**1. رفع الكود على GitHub**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/USERNAME/REPO_NAME.git
git push -u origin main
```

**2. إنشاء مشروع على Railway**
- اذهب إلى [railway.app](https://railway.app)
- اضغط **New Project** → **Deploy from GitHub repo**
- اختر الـ repository

**3. إضافة قاعدة بيانات MySQL**
- في لوحة Railway اضغط **+ Add Service** → **Database** → **MySQL**
- انسخ الـ `DATABASE_URL` من قاعدة البيانات

**4. إضافة المتغيرات البيئية**

في **Variables** أضف:

| المتغير | القيمة |
|---|---|
| `DATABASE_URL` | (انسخه من MySQL service في Railway) |
| `JWT_SECRET` | (اكتب أي نص طويل عشوائي، 64 حرف على الأقل) |
| `NODE_ENV` | `production` |
| `PORT` | `3000` |

**5. تشغيل الـ migrations**

بعد أول deployment، افتح **Shell** في Railway وشغّل:
```bash
node -e "
const { drizzle } = require('drizzle-orm/mysql2');
const mysql = require('mysql2/promise');
// أو استخدم الـ SQL في ملف drizzle/migrations
"
```

أو الأسهل: انسخ محتوى ملفات `drizzle/migrations/*.sql` وشغّلها في MySQL console في Railway.

---

## الطريقة الثانية: Render (مجاني محدود) 🎨

**1. رفع الكود على GitHub** (نفس الخطوات أعلاه)

**2. إنشاء Web Service على Render**
- اذهب إلى [render.com](https://render.com)
- اضغط **New** → **Web Service**
- اختر الـ repository
- اختر **Docker** كـ Runtime (سيكتشف Dockerfile تلقائياً)

**3. إضافة قاعدة بيانات**
- اضغط **New** → **MySQL** (أو استخدم PlanetScale أو TiDB Cloud مجاناً)

**4. إضافة المتغيرات البيئية** (نفس الجدول أعلاه)

---

## الطريقة الثالثة: VPS (Hostinger / DigitalOcean) 🖥️

### المتطلبات:
- Ubuntu 22.04
- Node.js 22
- MySQL 8.0
- pnpm

### الخطوات:

```bash
# 1. تثبيت Node.js
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pnpm

# 2. تثبيت MySQL
sudo apt install mysql-server -y
sudo mysql_secure_installation

# 3. إنشاء قاعدة البيانات
sudo mysql -u root -p
CREATE DATABASE inspection_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'inspection_user'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON inspection_db.* TO 'inspection_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# 4. نسخ الكود
git clone https://github.com/USERNAME/REPO_NAME.git /var/www/inspection
cd /var/www/inspection

# 5. إنشاء ملف .env
cp env.example.txt .env
nano .env  # عدّل القيم

# 6. تثبيت التبعيات والبناء
pnpm install
pnpm run build

# 7. تشغيل الـ migrations (انسخ SQL من drizzle/migrations/)
mysql -u inspection_user -p inspection_db < drizzle/migrations/0000_*.sql

# 8. تشغيل الخادم مع PM2
npm install -g pm2
pm2 start "node dist/index.js" --name inspection-app
pm2 startup
pm2 save
```

### إعداد Nginx (اختياري للدومين):
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## الطريقة الرابعة: Docker Compose (أي سيرفر) 🐳

```bash
# 1. تثبيت Docker
curl -fsSL https://get.docker.com | sh

# 2. نسخ الكود
git clone https://github.com/USERNAME/REPO_NAME.git
cd REPO_NAME

# 3. إنشاء ملف .env
cp env.example.txt .env
# عدّل القيم في .env

# 4. تشغيل كل شيء بأمر واحد
docker-compose up -d

# 5. تشغيل الـ migrations
docker-compose exec app sh -c "cat drizzle/migrations/*.sql | mysql -h db -u inspection_user -pinspection_pass123 inspection_db"
```

---

## المتغيرات البيئية المطلوبة

| المتغير | مطلوب | الوصف |
|---|---|---|
| `DATABASE_URL` | ✅ | رابط الاتصال بـ MySQL |
| `JWT_SECRET` | ✅ | مفتاح تشفير الجلسات (64+ حرف) |
| `NODE_ENV` | ✅ | `production` |
| `PORT` | اختياري | المنفذ (افتراضي: 3000) |
| `VITE_APP_ID` | اختياري | لـ Manus OAuth |
| `OAUTH_SERVER_URL` | اختياري | لـ Manus OAuth |

---

## بعد الرفع - تشغيل الـ Migrations

بعد أول رفع، يجب تشغيل SQL لإنشاء الجداول. ملفات SQL موجودة في:
```
drizzle/migrations/0000_*.sql
drizzle/migrations/0001_*.sql
```

شغّلها على قاعدة البيانات مرة واحدة فقط.

---

## الروابط بعد الرفع

| الرابط | الوصف |
|---|---|
| `https://yourdomain.com/` | الصفحة الرئيسية |
| `https://yourdomain.com/booking` | صفحة حجز موعد |
| `https://yourdomain.com/payment` | صفحة الدفع |
| `https://yourdomain.com/nafath` | صفحة نفاذ |
| `https://yourdomain.com/motasel` | صفحة المتصل |
| `https://yourdomain.com/admin/login` | تسجيل دخول لوحة التحكم |
| `https://yourdomain.com/admin/dashboard` | لوحة التحكم الإدارية |

---

## ملاحظات مهمة ⚠️

1. **JWT_SECRET**: يجب أن يكون طويلاً وعشوائياً. يمكن توليده بـ: `openssl rand -hex 64`
2. **قاعدة البيانات**: تأكد من تشغيل الـ migrations قبل استخدام الموقع
3. **Socket.io**: يعمل تلقائياً مع الخادم، لا يحتاج إعداد إضافي
4. **الموقع الأمامي**: ملفات `client-site/` يجب أن تكون موجودة في نفس مجلد الخادم
