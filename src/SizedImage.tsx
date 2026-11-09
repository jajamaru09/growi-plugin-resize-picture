import React from 'react';
import type { ComponentType, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { growiReact } from '@growi/pluginkit/dist/v4/client/utils/growi-facade/growi-react';
import type { ImageSpan } from './image-span';
import type { RenderContext } from './rehype-resize-picture';
import { dragLimitPx, toPercent } from './drag-math';
import { injectStyles } from './styles';

export type OnResize = (target: ImageSpan, newWidth: number, atLimit: boolean) => boolean;

const C = {
  frame: 'grw-plugin-resize-picture-frame',
  handle: 'grw-plugin-resize-picture-handle',
  badge: 'grw-plugin-resize-picture-badge',
  dragging: 'grw-plugin-resize-picture-dragging',
};
const MOVE_THRESHOLD_PX = 3;
// ハンドルを出すのはページのエディタの中だけ。モーダルのプレビューはエディタの外にあり、
// 古い版の画面も id="page-editor" を持つため、本物のエディタにだけある data-testid で見分ける
const EDITOR_SCOPE = '[data-testid="page-editor"]';

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function readSpan(props: Record<string, unknown>): ImageSpan | null {
  const start = num(props['data-rp-start']);
  const end = num(props['data-rp-end']);
  if (start === undefined || end === undefined) return null;
  const span: ImageSpan = { start, end };
  const cs = num(props['data-rp-comment-start']);
  const ce = num(props['data-rp-comment-end']);
  if (cs !== undefined && ce !== undefined) { span.commentStart = cs; span.commentEnd = ce; }
  const w = num(props['data-rp-width']);
  if (w !== undefined) span.width = w;
  const src = props['data-rp-src'];
  if (typeof src === 'string' && src !== '') span.src = src;
  return span;
}

type DragState = {
  startX: number; startPx: number; containerPx: number; limitPx: number;
  moved: boolean; pointerId: number;
};

export function makeSizedImage(
  Original: ComponentType<any>,
  context: RenderContext,
  onResize?: OnResize,
): ComponentType<any> {
  return function SizedImage(props: any) {
    const R = growiReact(React);
    const { useRef, useState, useEffect } = R;
    const frameRef = useRef<HTMLSpanElement | null>(null);
    const badgeRef = useRef<HTMLSpanElement | null>(null);
    const dragRef = useRef<DragState | null>(null);
    const suppressClickRef = useRef(false);
    const [dragging, setDragging] = useState(false);
    const [inEditor, setInEditor] = useState(false);

    const width = num(props['data-rp-width']);
    const span = readSpan(props);
    const canDrag = context === 'preview' && !!onResize && !!span;

    useEffect(() => { injectStyles(); }, []);
    useEffect(() => { setInEditor(frameRef.current?.closest(EDITOR_SCOPE) != null); }, []);
    // 親から渡る幅が変わったら、ドラッグで直接変えた style を props の値に戻す
    useEffect(() => {
      if (frameRef.current) frameRef.current.style.width = width !== undefined ? `${width}%` : '';
    }, [width]);

    if (context === 'view' && width === undefined) return <Original {...props} />;

    const compute = (d: DragState, clientX: number) => {
      const px = Math.min(d.limitPx, Math.max(0, d.startPx + (clientX - d.startX)));
      return { px, percent: toPercent(px, d.containerPx), atLimit: px >= d.limitPx };
    };

    const onPointerDown = (e: ReactPointerEvent<HTMLSpanElement>) => {
      const frame = frameRef.current;
      const container = frame?.parentElement;
      if (!frame || !container) return;
      if (e.button !== 0) return;
      if (frame.closest(EDITOR_SCOPE) == null) return;
      const natural = frame.querySelector('img')?.naturalWidth ?? 0;
      if (natural <= 0) return;
      e.preventDefault();
      e.stopPropagation();
      const containerPx = container.getBoundingClientRect().width;
      dragRef.current = {
        startX: e.clientX,
        startPx: frame.getBoundingClientRect().width,
        containerPx,
        limitPx: dragLimitPx(natural, containerPx),
        moved: false,
        pointerId: e.pointerId,
      };
      try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* jsdom 等では無い */ }
      setDragging(true);
      if (badgeRef.current) {
        badgeRef.current.textContent = `${toPercent(dragRef.current.startPx, containerPx)}%`;
      }
    };

    const restoreWidth = () => {
      if (frameRef.current) frameRef.current.style.width = width !== undefined ? `${width}%` : '';
    };

    const onPointerCancel = (e: ReactPointerEvent<HTMLSpanElement>) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      dragRef.current = null;
      try { e.currentTarget.releasePointerCapture?.(d.pointerId); } catch { /* jsdom 等では無い */ }
      setDragging(false);
      restoreWidth();
    };

    const onPointerMove = (e: ReactPointerEvent<HTMLSpanElement>) => {
      const d = dragRef.current;
      const frame = frameRef.current;
      if (!d || !frame || e.pointerId !== d.pointerId) return;
      if (!d.moved && Math.abs(e.clientX - d.startX) < MOVE_THRESHOLD_PX) return;
      d.moved = true;
      const { px, percent, atLimit } = compute(d, e.clientX);
      frame.style.width = `${px}px`;
      if (badgeRef.current) {
        badgeRef.current.textContent = atLimit && d.limitPx < d.containerPx ? '原寸' : `${percent}%`;
      }
    };

    const onPointerUp = (e: ReactPointerEvent<HTMLSpanElement>) => {
      const d = dragRef.current;
      const frame = frameRef.current;
      if (!d || !frame || e.pointerId !== d.pointerId) return;
      dragRef.current = null;
      try { e.currentTarget.releasePointerCapture?.(d.pointerId); } catch { /* jsdom 等では無い */ }
      setDragging(false);
      if (!d.moved) return;
      const { percent, atLimit } = compute(d, e.clientX);
      frame.style.width = `${percent}%`;
      suppressClickRef.current = true;
      setTimeout(() => { suppressClickRef.current = false; }, 0);
      const changed = onResize && span ? onResize(span, percent, atLimit) : false;
      if (!changed) restoreWidth();
    };

    const onClickCapture = (e: ReactMouseEvent) => {
      if (!suppressClickRef.current) return;
      suppressClickRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    };

    return (
      <span
        ref={frameRef}
        className={dragging ? `${C.frame} ${C.dragging}` : C.frame}
        style={width !== undefined ? { width: `${width}%` } : undefined}
        onClickCapture={onClickCapture}
      >
        <Original {...props} />
        {canDrag && inEditor && (
          <>
            <span ref={badgeRef} className={C.badge} />
            <span
              className={C.handle}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              onLostPointerCapture={onPointerCancel}
            />
          </>
        )}
      </span>
    );
  };
}
