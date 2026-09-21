# Katta (NestJS + React)

Bản chuyển đổi của ứng dụng học tiếng Anh Katta từ Laravel sang **Node.js + NestJS + React**.

- `backend/`  - NestJS 11 + Prisma 6 + MySQL (dùng chung database `katta` của bản Laravel)
- `frontend/` - React 19 + Vite + TypeScript + Tailwind CSS 4

## Chạy thử

```bash
# 1) Backend (cổng 3000) - cần MySQL đang chạy, database "katta"
cd backend
cp .env.example .env      # rồi sửa DATABASE_URL, JWT_SECRET
npm install
npx prisma generate
npm run start:dev

# 2) Frontend (cổng 5173) - mở http://localhost:5173
cd frontend
npm install
npm run dev
```

Test backend: `cd backend && npm run test:e2e`
