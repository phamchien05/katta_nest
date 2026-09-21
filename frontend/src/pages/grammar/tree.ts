import type { TopicNode } from '../../api/grammar'

export interface TreeNode {
  topic: TopicNode
  children: TreeNode[]
}

// Dựng cây lồng nhau từ danh sách phẳng (đã sắp theo `order`) - một lần duyệt, không đệ quy lặp lại việc tìm con
export function buildTree(flat: readonly TopicNode[]): TreeNode[] {
  const nodes = new Map<number, TreeNode>(flat.map((t) => [t.id, { topic: t, children: [] }]))
  const roots: TreeNode[] = []
  for (const t of flat) {
    const node = nodes.get(t.id)!
    const parent = t.parentId === null ? undefined : nodes.get(t.parentId)
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

// Id của bài và mọi tổ tiên - để tự mở đúng đường dẫn trong accordion
export function ancestorIds(flat: readonly TopicNode[], slug: string | undefined): Set<number> {
  const byId = new Map(flat.map((t) => [t.id, t]))
  const ids = new Set<number>()
  let cursor = flat.find((t) => t.slug === slug)
  while (cursor && !ids.has(cursor.id)) {
    ids.add(cursor.id)
    cursor = cursor.parentId === null ? undefined : byId.get(cursor.parentId)
  }
  return ids
}

// Bài mặc định khi chưa chọn: bài đầu tiên có nội dung
export const defaultSlug = (flat: readonly TopicNode[]): string | undefined => flat.find((t) => t.hasContent)?.slug
