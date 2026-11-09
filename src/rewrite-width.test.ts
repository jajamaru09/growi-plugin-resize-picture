import { it, expect } from 'vitest';
import { rewriteWidth } from './rewrite-width';
import type { ImageSpan } from './image-span';

const doc = 'a ![x](u)<!--50%--> b ![y](v) c';
const withC: ImageSpan = { start: 2, end: 9, commentStart: 9, commentEnd: 19, width: 50 };
const noC: ImageSpan = { start: 22, end: 29 };
it('insert when no comment', () => expect(rewriteWidth(doc, noC, 30, false)).toEqual({ kind: 'change', from: 29, to: 29, insert: '<!--30%-->' }));
it('noop at limit without comment', () => expect(rewriteWidth(doc, noC, 100, true)).toEqual({ kind: 'noop' }));
it('replace comment', () => expect(rewriteWidth(doc, withC, 35, false)).toEqual({ kind: 'change', from: 9, to: 19, insert: '<!--35%-->' }));
it('remove comment at limit', () => expect(rewriteWidth(doc, withC, 70, true)).toEqual({ kind: 'change', from: 9, to: 19, insert: '' }));
it('remove comment and the spaces before it', () => {
  const d = '![x](u)  <!-- 50% -->';
  expect(rewriteWidth(d, { start: 0, end: 7, commentStart: 9, commentEnd: 21, width: 50 }, 100, true)).toEqual({ kind: 'change', from: 7, to: 21, insert: '' });
});
it('noop when same width', () => expect(rewriteWidth(doc, withC, 50, false)).toEqual({ kind: 'noop' }));
it('mismatch when image text moved', () => expect(rewriteWidth('zz' + doc, noC, 30, false)).toEqual({ kind: 'mismatch' }));
it('mismatch when comment text moved', () => expect(rewriteWidth(doc.replace('<!--50%-->', '<!--5%-->'), withC, 30, false)).toEqual({ kind: 'mismatch' }));
it('targets the right one of two identical images', () => {
  const d = '![a](u)![a](u)<!--50%-->';
  expect(rewriteWidth(d, { start: 0, end: 7 }, 20, false)).toEqual({ kind: 'change', from: 7, to: 7, insert: '<!--20%-->' });
});
it('mismatch when a valid comment already follows an image the span says has none (stale preview)', () => {
  expect(rewriteWidth(doc, { start: 2, end: 9 }, 30, false)).toEqual({ kind: 'mismatch' });
  expect(rewriteWidth('![x](u) \t<!-- 40% --> z', { start: 0, end: 7 }, 30, false)).toEqual({ kind: 'mismatch' });
});
it('still inserts when the following comment is not a valid width comment', () => {
  expect(rewriteWidth('![x](u)<!--abc-->', { start: 0, end: 7 }, 30, false)).toEqual({ kind: 'change', from: 7, to: 7, insert: '<!--30%-->' });
});
it('mismatch when src differs even if the length is the same (stale preview, neighbouring attachment)', () => {
  const a = '![image.png](/attachment/aaaaaaaaaaaaaaaaaaaaaaaa)';
  const b = '![image.png](/attachment/bbbbbbbbbbbbbbbbbbbbbbbb)';
  expect(a.length).toBe(b.length);
  const d = `${b}\n${a}`;
  // preview thought offset 0..len is `a`, but the doc now has `b` there
  expect(rewriteWidth(d, { start: 0, end: a.length, src: a }, 30, false)).toEqual({ kind: 'mismatch' });
  expect(rewriteWidth(d, { start: 0, end: a.length }, 30, false)).toEqual({ kind: 'change', from: a.length, to: a.length, insert: '<!--30%-->' });
});
it('proceeds when src matches', () => {
  const a = '![x](u)';
  expect(rewriteWidth(a, { start: 0, end: 7, src: a }, 30, false)).toEqual({ kind: 'change', from: 7, to: 7, insert: '<!--30%-->' });
});
