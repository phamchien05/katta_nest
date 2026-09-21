import { describe, expect, it } from 'vitest'
import type { TopicNode } from '../../api/grammar'
import { ancestorIds, buildTree, defaultSlug } from './tree'

const t = (id: number, parentId: number | null, slug: string, hasContent = true): TopicNode => ({
  id,
  parentId,
  title: slug,
  slug,
  order: id,
  hasContent,
})

const flat = [t(1, null, 'tenses', false), t(2, 1, 'present', false), t(3, 2, 'present-simple'), t(4, 2, 'present-continuous'), t(5, 1, 'past'), t(6, null, 'other')]

describe('buildTree', () => {
  it('dựng cây lồng nhau, giữ thứ tự anh em', () => {
    const tree = buildTree(flat)
    expect(tree.map((n) => n.topic.slug)).toEqual(['tenses', 'other'])
    expect(tree[0].children.map((n) => n.topic.slug)).toEqual(['present', 'past'])
    expect(tree[0].children[0].children.map((n) => n.topic.slug)).toEqual(['present-simple', 'present-continuous'])
  })

  it('danh sách rỗng -> cây rỗng; nút mồ côi (cha không tồn tại) được coi là gốc', () => {
    expect(buildTree([])).toEqual([])
    expect(buildTree([t(9, 404, 'orphan')]).map((n) => n.topic.slug)).toEqual(['orphan'])
  })
})

describe('ancestorIds', () => {
  it('gồm chính bài và mọi tổ tiên', () => {
    expect([...ancestorIds(flat, 'present-simple')].sort()).toEqual([1, 2, 3])
    expect([...ancestorIds(flat, 'other')]).toEqual([6])
  })

  it('slug không tồn tại hoặc chưa chọn -> rỗng', () => {
    expect(ancestorIds(flat, 'nope').size).toBe(0)
    expect(ancestorIds(flat, undefined).size).toBe(0)
  })

  it('không lặp vô hạn nếu dữ liệu có vòng tròn', () => {
    const loop = [t(1, 2, 'a'), t(2, 1, 'b')]
    expect(ancestorIds(loop, 'a').size).toBe(2)
  })
})

describe('defaultSlug', () => {
  it('bài đầu tiên có nội dung; không có bài nào thì undefined', () => {
    expect(defaultSlug(flat)).toBe('present-simple')
    expect(defaultSlug([t(1, null, 'x', false)])).toBeUndefined()
    expect(defaultSlug([])).toBeUndefined()
  })
})
