import { fetchPassages, fetchReadingHistory, GENERAL_LEVELS, TOPICS } from '../../api/reading'
import { PassageBrowser } from '../../components/PassageBrowser'

// Trang Đọc hiểu: danh sách bài nhóm theo chủ đề + tab "Đã đọc"
export function ReadingHome() {
  return (
    <PassageBrowser
      module="reading"
      topics={TOPICS}
      generalLevels={GENERAL_LEVELS}
      fetchPassages={fetchPassages}
      fetchHistory={fetchReadingHistory}
    />
  )
}
