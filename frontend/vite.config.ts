import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Frontend gọi API qua đường dẫn tương đối "/api/..." - Vite chuyển tiếp sang backend NestJS (cổng 3000).
// Nhờ vậy trình duyệt coi frontend + backend là cùng 1 origin: cookie đăng nhập (httpOnly) hoạt động
// bình thường và không cần cấu hình CORS.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
