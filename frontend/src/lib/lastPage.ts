// Trang người dùng vừa đứng trước khi mở form Phản hồi - tự gửi kèm làm ngữ cảnh để biết lỗi xảy ra ở đâu
// (bản Laravel lấy từ header Referer; SPA không có referer nên tự ghi lại khi chuyển trang).
const KEY = 'katta_last_page'

export function rememberPage(pathAndSearch: string): void {
  try {
    sessionStorage.setItem(KEY, pathAndSearch)
  } catch {
    // không lưu được thì chỉ mất phần ngữ cảnh
  }
}

export function lastPage(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}
