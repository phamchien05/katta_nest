import { fetchListeningHistory, fetchPassages, GENERAL_LEVELS, TOPICS } from '../../api/listening'
import { PassageBrowser } from '../../components/PassageBrowser'

// Trang Nghe: danh sách bài nhóm theo chủ đề + tab lịch sử
export function ListeningHome() {
  return (
    <PassageBrowser
      module="listening"
      topics={TOPICS}
      generalLevels={GENERAL_LEVELS}
      fetchPassages={fetchPassages}
      fetchHistory={fetchListeningHistory}
    />
  )
}
