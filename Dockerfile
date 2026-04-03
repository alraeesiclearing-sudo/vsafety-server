# ============================================================
# المرحلة 1: بناء الواجهة الأمامية (React/Vite)
# ============================================================
FROM node:22-alpine AS frontend-builder

WORKDIR /app

# تثبيت pnpm
RUN npm install -g pnpm@10.4.1

# نسخ ملفات التبعيات أولاً (للاستفادة من cache)
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# تثبيت جميع التبعيات
RUN pnpm install --frozen-lockfile

# نسخ باقي الملفات
COPY . .

# بناء الواجهة الأمامية (React → dist/public)
RUN pnpm run build

# ============================================================
# المرحلة 2: صورة الإنتاج النهائية
# ============================================================
FROM node:22-alpine AS production

WORKDIR /app

# تثبيت pnpm
RUN npm install -g pnpm@10.4.1

# نسخ ملفات التبعيات
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# تثبيت تبعيات الإنتاج فقط
RUN pnpm install --frozen-lockfile --prod

# نسخ ملفات البناء من المرحلة السابقة
COPY --from=frontend-builder /app/dist ./dist

# نسخ ملفات الخادم المبنية (esbuild output)
COPY --from=frontend-builder /app/dist/index.js ./dist/index.js

# نسخ مجلد client-site (الموقع الأمامي الأصلي)
COPY --from=frontend-builder /app/client-site ./client-site

# نسخ ملفات الـ drizzle schema للـ migrations
COPY --from=frontend-builder /app/drizzle ./drizzle

# نسخ ملف shared
COPY --from=frontend-builder /app/shared ./shared

# المنفذ الافتراضي
EXPOSE 3000

# متغير البيئة
ENV NODE_ENV=production

# أمر التشغيل
CMD ["node", "dist/index.js"]
