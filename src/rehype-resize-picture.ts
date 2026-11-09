import type { Element, Root as HastRoot } from 'hast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

import { FILE_DATA_KEY, type ImageSpan } from './image-span';
import type { LogFn } from './remark-resize-picture';

export type RenderContext = 'view' | 'preview';

export const rehypeResizePicture: Plugin<[{ context: RenderContext; log?: LogFn }], HastRoot> = (options) => {
  const { context, log } = options;
  return (tree, file) => {
    const spans = file.data[FILE_DATA_KEY] as Map<number, ImageSpan> | undefined;
    if (!(spans instanceof Map)) return;

    let tagged = 0;
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'img') return;
      const offset = node.position?.start.offset;
      if (offset == null) return;
      const span = spans.get(offset);
      if (span == null) return;

      const props = node.properties;
      if (span.width != null) props.dataRpWidth = span.width;
      if (context === 'preview') {
        props.dataRpStart = span.start;
        props.dataRpEnd = span.end;
        if (span.src != null) props.dataRpSrc = span.src;
        if (span.commentStart != null && span.commentEnd != null) {
          props.dataRpCommentStart = span.commentStart;
          props.dataRpCommentEnd = span.commentEnd;
        }
      }
      tagged += 1;
    });
    log?.(`[resize-picture] rehype(${context}): ${tagged} img tagged`);
  };
};
