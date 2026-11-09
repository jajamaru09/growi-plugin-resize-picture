import type { Html, Image, Parent, Root as MdastRoot } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

import { FILE_DATA_KEY, type ImageSpan } from './image-span';
import { parseWidthComment } from './parse-width-comment';

export type LogFn = (...args: unknown[]) => void;

/** 画像と html ノードの間に挟んでよい、改行を含まない空白だけの text か */
const isInlineBlank = (node: { type: string; value?: string }): boolean =>
  node.type === 'text' && typeof node.value === 'string' && /^[ \t]+$/.test(node.value);

export const remarkResizePicture: Plugin<[{ log?: LogFn }?], MdastRoot> = (options) => {
  const log = options?.log;
  return (tree, file) => {
    const spans = new Map<number, ImageSpan>();

    const linked = new Set<Image>();
    visit(tree, 'link', (link) => { visit(link, 'image', (img: Image) => { linked.add(img); }); });

    visit(tree, 'image', (image: Image, index: number | undefined, parent: Parent | undefined) => {
      const start = image.position?.start.offset;
      const end = image.position?.end.offset;
      if (start == null || end == null) return;

      // リンクで囲んだ画像は対象外（幅もハンドルも付けない）
      if (linked.has(image)) return;

      const span: ImageSpan = { start, end, src: String(file).slice(start, end) };

      if (parent != null && index != null) {
        let next = parent.children[index + 1];
        if (next != null && isInlineBlank(next as { type: string; value?: string })) {
          next = parent.children[index + 2];
        }
        if (next != null && next.type === 'html') {
          const html = next as Html;
          const width = parseWidthComment(html.value);
          const cs = html.position?.start.offset;
          const ce = html.position?.end.offset;
          if (width != null && cs != null && ce != null) {
            span.width = width;
            span.commentStart = cs;
            span.commentEnd = ce;
          }
        }
      }
      spans.set(start, span);
    });

    file.data[FILE_DATA_KEY] = spans;
    const withWidth = [...spans.values()].filter((s) => s.width != null).length;
    log?.(`[resize-picture] remark: ${spans.size} images, ${withWidth} with width`);
  };
};
