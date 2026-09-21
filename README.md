# Katta (NestJS + React)

Ứng dụng học tiếng Anh cho người Việt, chuyển từ Laravel sang **Node.js + NestJS + React**.

- `backend/`  - NestJS 11 + Prisma 6 + MySQL (dùng chung database `katta` với bản Laravel cũ, không cần chuyển dữ liệu)
- `frontend/` - React 19 + Vite + TypeScript + Tailwind CSS 4 + i18next (tiếng Anh mặc định, chuyển được sang tiếng Việt)

## Các module

| Module | Nội dung |
|---|---|
| Đăng nhập / Hồ sơ | JWT trong cookie httpOnly, chặn dò mật khẩu (5 lần sai/phút), đổi tên/email/mật khẩu, xoá tài khoản |
| Trang chủ | Streak, biểu đồ 7 ngày, thống kê nhanh, hoạt động gần đây |
| Từ vựng | Kiểm tra 50 từ theo 6 cấp CEFR, chấm ở server |
| Dịch | Dịch EN↔VI, Gemini chấm điểm (có chấm tạm khi chưa có key) |
| Đọc hiểu | Bài đọc kiểu IELTS, 4 loại câu hỏi |
| Ngữ pháp | Lý thuyết (135 chủ đề) + kho đề luyện tập 35 câu |
| Nghe | Bài nghe đọc bằng Web Speech API, tối đa 3 lượt nghe, ẩn lời thoại tới khi nộp |
| Tiến trình / Thống kê | Lịch sử làm bài từ mọi module, lịch ngày học, độ chính xác |
| Phản hồi | Gửi phản hồi kèm ảnh chụp màn hình |
| Cài đặt | Ngôn ngữ, API key Gemini riêng (mã hoá) |

Dịch, Đọc hiểu, Ngữ pháp, Nghe dùng **kho tự bù**: mỗi lần người dùng lấy một bài ra làm, server nhờ Gemini sinh ngầm một bài mới bù vào kho.

Chưa làm (chưa có ở bản Laravel): Thành ngữ, Trò chuyện AI, Nói, trang quản trị. Các mục này hiện là trang giữ chỗ.

## Chạy thử

Cần Node 22+ và MySQL đang chạy với database `katta`.

```bash
# 1) Backend (cổng 3000)
cd backend
cp .env.example .env      # rồi điền các biến bên dưới
npm install
npx prisma generate
npm run start:dev

# 2) Frontend (cổng 5173) - mở http://localhost:5173
cd frontend
npm install
npm run dev
```

### Biến môi trường (`backend/.env`)

| Biến | Ý nghĩa |
|---|---|
| `DATABASE_URL` | Chuỗi kết nối MySQL |
| `JWT_SECRET` | Chuỗi bí mật ký cookie đăng nhập (dài, ngẫu nhiên) |
| `APP_KEY` | Khoá mã hoá API key riêng của người dùng, dạng `base64:...` (32 byte). Dùng **cùng giá trị với `.env` của bản Laravel** thì đọc được các key đã lưu |
| `GEMINI_API_KEY` | Key Gemini dùng chung cho người chưa nhập key riêng |
| `APP_TIMEZONE` | Múi giờ tính "ngày học" (streak, lịch). Mặc định `Asia/Ho_Chi_Minh` |
| `UPLOAD_DIR` | Thư mục lưu ảnh phản hồi. Mặc định `./uploads` (đã được gitignore) |

Không đưa `.env` lên git.

## Kiểm tra

```bash
bash scripts/verify.sh   # lint + typecheck + toàn bộ test + build, dừng ngay khi có lỗi
```

Test backend dùng DB giả trong bộ nhớ nên không bao giờ đụng tới MySQL thật.
