// Biểu đồ đường + vùng tô nhẹ bằng SVG thuần (không cần thư viện biểu đồ) - dùng cho "Hành trình học tập"
interface Point {
  label: string
  value: number
}

const W = 600
const H = 180
const PAD = { top: 12, right: 16, bottom: 26, left: 30 }

export function LineChart({ points }: { points: Point[] }) {
  // Chưa có dữ liệu (đang tải): giữ nguyên chiều cao để trang không nhảy khi dữ liệu về
  if (points.length === 0) return <div className="w-full" style={{ aspectRatio: `${W} / ${H}` }} />

  // Trục Y chỉ có số nguyên (đếm số buổi học), tối thiểu 0..2 để đường phẳng vẫn nhìn rõ
  const max = Math.max(2, ...points.map((p) => p.value))
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH

  // Đường cong mượt: tiếp tuyến nằm ngang tại mỗi điểm nên không bao giờ vọt lên dưới 0 hay quá đỉnh
  const coords = points.map((p, i) => [x(i), y(p.value)] as const)
  const line = coords
    .map(([px, py], i) => {
      if (i === 0) return `M${px},${py}`
      const [qx, qy] = coords[i - 1]
      const mid = (qx + px) / 2
      return `C${mid},${qy} ${mid},${py} ${px},${py}`
    })
    .join(' ')
  const baseline = y(0)
  const area = `${line} L${x(points.length - 1)},${baseline} L${x(0)},${baseline} Z`
  const ticks = Array.from({ length: max + 1 }, (_, i) => i).filter((v) => max <= 4 || v % Math.ceil(max / 4) === 0)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="#f3f4f6" />
          <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#9ca3af">
            {v}
          </text>
        </g>
      ))}
      <path d={area} fill="rgba(124, 58, 237, 0.08)" />
      <path d={line} fill="none" stroke="#7c3aed" strokeWidth="2" />
      {coords.map(([px, py], i) => (
        <circle key={points[i].label} cx={px} cy={py} r="3.5" fill="#7c3aed">
          <title>{`${points[i].label}: ${points[i].value}`}</title>
        </circle>
      ))}
      {points.map((p, i) => (
        <text key={p.label} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="#9ca3af">
          {p.label}
        </text>
      ))}
    </svg>
  )
}
