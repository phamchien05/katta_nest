import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { findNavItem } from '../config/nav'

// Trang giữ chỗ cho các module chưa chuyển sang hệ thống mới - sẽ được thay dần từng module một
export function Placeholder() {
  const { t } = useTranslation()
  const item = findNavItem(useLocation().pathname)
  const Icon = item?.icon

  return (
    <div className="max-w-2xl mx-auto mt-10 bg-white rounded-2xl shadow-sm p-10 text-center">
      {Icon && <Icon className="w-10 h-10 text-katta-primary/60 mx-auto mb-3" />}
      <p className="font-bold text-gray-800">{item ? t(`nav.${item.key}`) : ''}</p>
      <p className="text-sm text-gray-400 mt-1">{t('placeholder.coming_soon')}</p>
    </div>
  )
}
