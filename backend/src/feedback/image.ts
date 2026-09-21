export interface DetectedImage {
  ext: 'png' | 'jpg' | 'gif' | 'webp';
  mime: string;
}

const startsWith = (buf: Buffer, bytes: number[], offset = 0): boolean =>
  buf.length >= offset + bytes.length &&
  bytes.every((b, i) => buf[offset + i] === b);

// Nhận diện ảnh theo NỘI DUNG (magic bytes), không tin tên file/Content-Type do client gửi. Chỉ nhận PNG/JPEG/GIF/WebP -
// cố ý KHÔNG nhận SVG vì SVG có thể chứa script (XSS) khi được phục vụ lại cho người xem.
export function detectImage(buf: Buffer): DetectedImage | null {
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (startsWith(buf, [0xff, 0xd8, 0xff])) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38])) {
    return { ext: 'gif', mime: 'image/gif' };
  }
  // WebP: "RIFF" + 4 byte kích thước + "WEBP"
  if (
    startsWith(buf, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

// Content-Type khi phục vụ lại: theo đuôi file đã lưu (kể cả file cũ do bản Laravel lưu); đuôi lạ -> không phục vụ
export function mimeForFile(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? null;
}
