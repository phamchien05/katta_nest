// Lớp gọi API dùng chung: luôn gửi kèm cookie đăng nhập (httpOnly), tự chuyển lỗi của NestJS
// (ValidationPipe trả mảng message) thành ApiError có thể hiển thị thẳng cho người dùng.
export class ApiError extends Error {
  readonly status: number
  readonly messages: string[]

  constructor(status: number, messages: string[]) {
    super(messages[0] ?? `HTTP ${status}`)
    this.status = status
    this.messages = messages
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  let messages: string[] = []
  try {
    const body = (await res.json()) as { message?: string | string[] }
    if (Array.isArray(body.message)) messages = body.message
    else if (typeof body.message === 'string') messages = [body.message]
  } catch {
    // phản hồi không phải JSON - giữ messages rỗng, ApiError sẽ dùng mã HTTP
  }
  return new ApiError(res.status, messages)
}

export async function api<T = void>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    credentials: 'include',
    headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })

  if (!res.ok) throw await toApiError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
