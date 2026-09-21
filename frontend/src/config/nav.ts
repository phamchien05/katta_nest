import {
  Book,
  Bookmark,
  ChartNoAxesColumn,
  Globe,
  Headphones,
  House,
  Lightbulb,
  MessageCircle,
  MessageSquare,
  Mic,
  Pencil,
  Settings,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  /** khoá dịch trong locales: nav.<key> */
  key: string
  path: string
  icon: LucideIcon
}

// 13 mục sidebar - đường dẫn giữ đúng như bản Laravel (config/katta.php) để link/bookmark cũ vẫn khớp
export const NAV_ITEMS: NavItem[] = [
  { key: 'home', path: '/', icon: House },
  { key: 'vocabulary', path: '/vocabulary', icon: Book },
  { key: 'translate', path: '/translate', icon: Globe },
  { key: 'reading', path: '/reading', icon: Bookmark },
  { key: 'grammar', path: '/grammar', icon: Pencil },
  { key: 'idioms', path: '/idioms', icon: Lightbulb },
  { key: 'listening', path: '/listening', icon: Headphones },
  { key: 'speaking', path: '/speaking', icon: Mic },
  { key: 'ai_chat', path: '/ai-chat', icon: MessageCircle },
  { key: 'progress', path: '/progress', icon: TrendingUp },
  { key: 'statistics', path: '/statistics', icon: ChartNoAxesColumn },
  { key: 'feedback', path: '/feedback', icon: MessageSquare },
  { key: 'settings', path: '/settings', icon: Settings },
]

// Câu nhắn ủng hộ hiển thị luân phiên ngẫu nhiên ở giữa header (giữ nguyên từ bản Laravel)
export const HEADER_TAGLINES = [
  'Hãy quyên góp giúp tôi 🙏',
  'Nhà phát triển nghèo cần cơm 🍚',
  'Katta - học tiếng Anh mỗi ngày cùng bạn',
  'Một ly cà phê cho dev cũng được ☕',
  'Ủng hộ để Katta có thêm nhiều bài học mới',
  'Code bằng cả trái tim (và mì gói) 🍜',
]

/** Tìm mục sidebar ứng với đường dẫn hiện tại ('/' chỉ khớp đúng trang chủ, còn lại khớp theo tiền tố). */
export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => (item.path === '/' ? pathname === '/' : pathname.startsWith(item.path)))
}
