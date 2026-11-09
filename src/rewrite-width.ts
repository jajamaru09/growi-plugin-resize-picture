import type { ImageSpan } from './image-span';
import { parseWidthComment } from './parse-width-comment';

export type RewriteResult =
  | { kind: 'change'; from: number; to: number; insert: string }
  | { kind: 'noop' }
  | { kind: 'mismatch' };

export function rewriteWidth(doc: string, target: ImageSpan, newWidth: number, atLimit: boolean): RewriteResult {
  const image = doc.slice(target.start, target.end);
  if (target.src != null && image !== target.src) return { kind: 'mismatch' };
  if (!image.startsWith('![') || !image.endsWith(')')) return { kind: 'mismatch' };

  const { commentStart, commentEnd } = target;
  if (commentStart == null || commentEnd == null) {
    // A complete valid width comment already follows: the preview is stale; do not add a second one.
    const following = /^[ 	]*(<!--[ 	]*[1-9][0-9]*%[ 	]*-->)/.exec(doc.slice(target.end));
    if (following != null && parseWidthComment(following[1]) != null) return { kind: 'mismatch' };
    if (atLimit) return { kind: 'noop' };
    return { kind: 'change', from: target.end, to: target.end, insert: `<!--${newWidth}%-->` };
  }

  const current = parseWidthComment(doc.slice(commentStart, commentEnd));
  if (current == null || !/^[ \t]*$/.test(doc.slice(target.end, commentStart))) return { kind: 'mismatch' };

  if (atLimit) return { kind: 'change', from: target.end, to: commentEnd, insert: '' };
  if (current === newWidth) return { kind: 'noop' };
  return { kind: 'change', from: commentStart, to: commentEnd, insert: `<!--${newWidth}%-->` };
}
