import type { ImageSpan } from './image-span';
import type { LogFn } from './remark-resize-picture';
import { rewriteWidth } from './rewrite-width';

export interface EditorViewLike {
  state: { doc: { toString(): string }; readOnly: boolean };
  contentDOM: HTMLElement;
  dispatch(spec: { changes: { from: number; to: number; insert: string } }): void;
}

// 古い版の画面（PageEditorReadOnly）も id="page-editor" と page-editor-editor-container を持つので、
// 本物のページエディタにだけある data-testid で絞る
const PAGE_EDITOR_SCOPE = '[data-testid="page-editor"]';

function viewOf(content: Element): EditorViewLike | null {
  const tile = (content as unknown as { cmTile?: { parent?: { view?: EditorViewLike }; view?: EditorViewLike } }).cmTile;
  if (tile == null) return null;
  return tile.parent?.view ?? tile.view ?? null;
}

function isEditable(view: EditorViewLike): boolean {
  return !view.state.readOnly && view.contentDOM.contentEditable === 'true';
}

/**
 * Find the page editor's CodeMirror EditorView from the DOM (re-resolved on every call).
 * Candidates are all `.cm-content` whose view is editable. Narrow to those inside the page-editor
 * scope (`[data-testid="page-editor"]`); if exactly one remains use it, otherwise
 * return null (none or ambiguous -> give up). A lone candidate outside the scope is never used.
 */
export function getMainEditorView(root: Document = document): EditorViewLike | null {
  const candidates: { el: Element; view: EditorViewLike }[] = [];
  for (const el of Array.from(root.querySelectorAll('.cm-content'))) {
    const view = viewOf(el);
    if (view != null && isEditable(view)) candidates.push({ el, view });
  }
  const scoped = candidates.filter((c) => c.el.closest(PAGE_EDITOR_SCOPE) != null);
  return scoped.length === 1 ? scoped[0].view : null;
}

export function applyWidthChange(
  target: ImageSpan,
  newWidth: number,
  atLimit: boolean,
  log: LogFn,
  getView: () => EditorViewLike | null = getMainEditorView,
): boolean {
  try {
    const view = getView();
    if (view == null) { log('resize-picture: give up (no-view)'); return false; }
    if (!isEditable(view)) { log('resize-picture: give up (read-only)'); return false; }
    const result = rewriteWidth(view.state.doc.toString(), target, newWidth, atLimit);
    if (result.kind === 'noop') return false;
    if (result.kind === 'mismatch') { log('resize-picture: give up (mismatch)'); return false; }
    view.dispatch({ changes: { from: result.from, to: result.to, insert: result.insert } });
    return true;
  } catch (e) {
    try { log('resize-picture: give up (error)', e); } catch { /* ignore */ }
    return false;
  }
}
