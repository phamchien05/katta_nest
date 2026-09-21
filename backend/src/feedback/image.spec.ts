import { detectImage, mimeForFile } from './image';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const gif = Buffer.from('GIF89a....');
const webp = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([1, 2, 3, 4]),
  Buffer.from('WEBPVP8 '),
]);

describe('detectImage', () => {
  it('nhận PNG, JPEG, GIF, WebP theo nội dung', () => {
    expect(detectImage(png)).toEqual({ ext: 'png', mime: 'image/png' });
    expect(detectImage(jpg)).toEqual({ ext: 'jpg', mime: 'image/jpeg' });
    expect(detectImage(gif)).toEqual({ ext: 'gif', mime: 'image/gif' });
    expect(detectImage(webp)).toEqual({ ext: 'webp', mime: 'image/webp' });
  });

  it('từ chối SVG, HTML, văn bản, file rỗng hoặc quá ngắn', () => {
    expect(
      detectImage(
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      ),
    ).toBeNull();
    expect(
      detectImage(Buffer.from('<html><script>alert(1)</script></html>')),
    ).toBeNull();
    expect(detectImage(Buffer.from('hello world'))).toBeNull();
    expect(detectImage(Buffer.alloc(0))).toBeNull();
    expect(detectImage(Buffer.from([0x89, 0x50]))).toBeNull();
  });

  it('RIFF không phải WebP (vd WAV/AVI) bị từ chối', () => {
    const wav = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([1, 2, 3, 4]),
      Buffer.from('WAVEfmt '),
    ]);
    expect(detectImage(wav)).toBeNull();
  });
});

describe('mimeForFile', () => {
  it('theo đuôi file, không phân biệt hoa thường', () => {
    expect(mimeForFile('a/b/x.PNG')).toBe('image/png');
    expect(mimeForFile('x.jpeg')).toBe('image/jpeg');
    expect(mimeForFile('x.webp')).toBe('image/webp');
  });

  it('đuôi lạ hoặc nguy hiểm -> null (không phục vụ)', () => {
    expect(mimeForFile('x.svg')).toBeNull();
    expect(mimeForFile('x.html')).toBeNull();
    expect(mimeForFile('x')).toBeNull();
  });
});
