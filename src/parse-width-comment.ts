const WIDTH_COMMENT = /^<!--[ \t]*([1-9][0-9]*)%[ \t]*-->$/;

export function parseWidthComment(html: string): number | null {
  const m = WIDTH_COMMENT.exec(html);
  if (m == null) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 100 ? n : null;
}
