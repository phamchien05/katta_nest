# Katta (NestJS + React)

Ứng dụng học tiếng Anh cho người Việt, viết bằng **Node.js + NestJS + React** (chuyển từ bản Laravel cũ).

- `backend/`  - NestJS 11 + Prisma 6 + MySQL
- `frontend/` - React 19 + Vite + TypeScript + Tailwind CSS 4 + i18next (tiếng Anh mặc định, chuyển được sang tiếng Việt)
- `database/katta.sql` - cấu trúc database + dữ liệu nội dung (từ vựng, ngữ pháp, bài đọc/nghe/dịch). Không chứa tài khoản hay lịch sử của ai.

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

Chưa làm: Thành ngữ, Trò chuyện AI, Nói, trang quản trị (hiện là trang giữ chỗ).

## Chạy dự án

Cần: **Node 22+**, **MySQL/MariaDB** (XAMPP dùng được). Ba bước, làm một lần đầu:

### 1) Tạo database

Bật MySQL (XAMPP Control Panel → Start ở dòng MySQL), rồi nạp file SQL:

```bash
# Windows + XAMPP (đổi đường dẫn nếu XAMPP của bạn ở chỗ khác)
D:\xampp\mysql\bin\mysql.exe -u root < database\katta.sql
```

Lệnh này tự tạo database `katta` cùng toàn bộ bảng và dữ liệu nội dung. Nếu MySQL của bạn có mật khẩu, thêm `-p`.
Chạy lại lần 2 sẽ báo lỗi "table already exists" - đó là chủ ý, để không xoá nhầm dữ liệu đang có.

### 2) Cấu hình và cài backend

```bash
cd backend
copy .env.example .env         # macOS/Linux: cp .env.example .env
```

Mở `backend/.env` và điền:

| Biến | Ý nghĩa |
|---|---|
| `DATABASE_URL` | Chuỗi kết nối MySQL. XAMPP mặc định: `mysql://root@127.0.0.1:3306/katta` |
| `JWT_SECRET` | Chuỗi bí mật ký cookie đăng nhập - đặt dài và ngẫu nhiên |
| `APP_KEY` | Khoá mã hoá API key riêng của người dùng, dạng `base64:...` (32 byte). Tạo bằng lệnh bên dưới |
| `GEMINI_API_KEY` | (Tuỳ chọn) key Gemini dùng chung. Không có thì Dịch chấm tạm theo độ dài và các kho bài không tự bù thêm. Lấy miễn phí ở Google AI Studio |
| `APP_TIMEZONE` | Múi giờ tính "ngày học". Mặc định `Asia/Ho_Chi_Minh` |
| `UPLOAD_DIR` | Thư mục lưu ảnh phản hồi. Mặc định `./uploads` |

Tạo `JWT_SECRET` và `APP_KEY` ngẫu nhiên:

```bash
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(48).toString('hex'))"
node -e "console.log('APP_KEY=base64:' + require('crypto').randomBytes(32).toString('base64'))"
```

Rồi cài và chạy:

```bash
npm install
npx prisma generate
npm run start:dev              # backend chạy ở http://localhost:3000
```

### 3) Chạy frontend (cửa sổ terminal thứ hai)

```bash
cd frontend
npm install
npm run dev                    # mở http://localhost:5173
```

Vào `http://localhost:5173`, bấm **Register** tạo tài khoản rồi dùng. Frontend tự chuyển các lời gọi `/api` sang backend nên không cần cấu hình thêm.

### Những lần sau

Chỉ cần bật MySQL, rồi chạy `npm run start:dev` trong `backend/` và `npm run dev` trong `frontend/`.

## Kiểm tra

```bash
bash scripts/verify.sh   # lint + typecheck + toàn bộ test + build, dừng ngay khi có lỗi
```

Test backend dùng DB giả trong bộ nhớ nên không bao giờ đụng tới MySQL thật.

## Xử lý sự cố

- **Đăng ký/đăng nhập báo lỗi kết nối, hoặc backend không khởi động**: MySQL chưa bật, hoặc `DATABASE_URL` sai (kiểm tra tên database là `katta`).
- **Trang trắng / lỗi mạng ở frontend**: backend chưa chạy ở cổng 3000.
- **Cổng bị chiếm**: đổi `PORT` trong `backend/.env`, và đổi địa chỉ `http://localhost:3000` trong `frontend/vite.config.ts` cho khớp.
- **Bài đọc/nghe không thấy bài mới được sinh thêm**: chưa có `GEMINI_API_KEY` (hoặc key riêng trong Cài đặt), hoặc đã hết hạn mức miễn phí trong ngày.
- **Không lưu được API key riêng (lỗi 503)**: `APP_KEY` trong `.env` bị thiếu hoặc không phải chuỗi `base64:` 32 byte.
