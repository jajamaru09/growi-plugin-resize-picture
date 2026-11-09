const STYLE_ID = 'grw-plugin-resize-picture-styles';

const CSS = `
.grw-plugin-resize-picture-frame { display: inline-block; position: relative; max-width: 100%; vertical-align: top; }
.grw-plugin-resize-picture-frame button,
.grw-plugin-resize-picture-frame img { width: 100%; height: auto; display: block; }
.grw-plugin-resize-picture-handle {
  position: absolute; right: 0; bottom: 0; width: 12px; height: 12px;
  background: #0d6efd; border: 1px solid #fff; cursor: nwse-resize;
  opacity: 0; touch-action: none; z-index: 1;
}
.grw-plugin-resize-picture-frame:hover .grw-plugin-resize-picture-handle,
.grw-plugin-resize-picture-dragging .grw-plugin-resize-picture-handle { opacity: 1; }
.grw-plugin-resize-picture-badge {
  position: absolute; right: 0; top: 0; padding: 0 6px; font-size: 12px; line-height: 20px;
  color: #fff; background: rgba(0, 0, 0, 0.7); pointer-events: none; display: none; z-index: 1;
}
.grw-plugin-resize-picture-dragging .grw-plugin-resize-picture-badge { display: block; }
.grw-plugin-resize-picture-dragging, .grw-plugin-resize-picture-dragging * { user-select: none; }
`;

export function injectStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}
