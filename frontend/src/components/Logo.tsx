// Logo Katta - ảnh thật gồm biểu tượng bút lông + chữ "Katta" + "English Learning", nên KHÔNG thêm chữ
// "Katta" riêng bên cạnh. Chỉ đặt chiều cao, để chiều rộng tự co theo tỉ lệ gốc (không bóp méo).
export function Logo({ className = 'h-10' }: { className?: string }) {
  return <img src="/logo.png" alt="Katta" className={`${className} w-auto object-contain shrink-0`} />
}
