// Avatar tròn: chữ cái đầu của tên, nền tím
export function Avatar({ name, className = 'w-9 h-9 text-sm' }: { name: string; className?: string }) {
  return (
    <div
      className={`${className} rounded-full bg-katta-primary text-white flex items-center justify-center font-semibold uppercase shrink-0`}
    >
      {name.trim().charAt(0)}
    </div>
  )
}
