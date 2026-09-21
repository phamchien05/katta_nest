import { BookOpen, Briefcase, Cpu, FlaskConical, HeartPulse, Landmark, Leaf, Users, type LucideIcon } from 'lucide-react'

// Màu nền + icon theo chủ đề - class viết nguyên văn để Tailwind quét thấy
export const TOPIC_STYLE: Record<string, { bg: string; icon: string; Icon: LucideIcon }> = {
  technology: { bg: 'bg-amber-50 border-amber-100', icon: 'bg-amber-100 text-amber-600', Icon: Cpu },
  science: { bg: 'bg-sky-50 border-sky-100', icon: 'bg-sky-100 text-sky-600', Icon: FlaskConical },
  environment: { bg: 'bg-emerald-50 border-emerald-100', icon: 'bg-emerald-100 text-emerald-600', Icon: Leaf },
  history: { bg: 'bg-orange-50 border-orange-100', icon: 'bg-orange-100 text-orange-600', Icon: Landmark },
  society: { bg: 'bg-purple-50 border-purple-100', icon: 'bg-purple-100 text-purple-600', Icon: Users },
  business: { bg: 'bg-blue-50 border-blue-100', icon: 'bg-blue-100 text-blue-600', Icon: Briefcase },
  health: { bg: 'bg-rose-50 border-rose-100', icon: 'bg-rose-100 text-katta-accent', Icon: HeartPulse },
  general: { bg: 'bg-white border-gray-100', icon: 'bg-gray-100 text-gray-500', Icon: BookOpen },
}

export const styleFor = (topic: string) => TOPIC_STYLE[topic] ?? TOPIC_STYLE.general
