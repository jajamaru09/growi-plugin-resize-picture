// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyWidthChange, getMainEditorView, type EditorViewLike } from './editor-bridge';
import type { ImageSpan } from './image-span';

const DOC = 'a ![x](u) b';
const target: ImageSpan = { start: 2, end: 9 };

function fakeView(over: Partial<{ readOnly: boolean; editable: boolean; dispatch: () => void }> = {}) {
  const contentDOM = document.createElement('div');
  contentDOM.contentEditable = over.editable === false ? 'false' : 'true';
  // jsdom does not reflect contentEditable; define it explicitly
  Object.defineProperty(contentDOM, 'contentEditable', { value: over.editable === false ? 'false' : 'true' });
  const dispatch = vi.fn(over.dispatch);
  const view: EditorViewLike = { state: { doc: { toString: () => DOC }, readOnly: over.readOnly ?? false }, contentDOM, dispatch };
  return { view, dispatch };
}

describe('applyWidthChange', () => {
  it('dispatches one change and returns true', () => {
    const { view, dispatch } = fakeView();
    const log = vi.fn();
    expect(applyWidthChange(target, 30, false, log, () => view)).toBe(true);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ changes: { from: 9, to: 9, insert: '<!--30%-->' } });
    expect(log).not.toHaveBeenCalled();
  });
  it('noop: no dispatch, false', () => {
    const { view, dispatch } = fakeView();
    expect(applyWidthChange(target, 100, true, vi.fn(), () => view)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });
  it('mismatch: no dispatch, false, logged', () => {
    const { view, dispatch } = fakeView();
    const log = vi.fn();
    expect(applyWidthChange({ start: 0, end: 5 }, 30, false, log, () => view)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0].join(' '))).toContain('mismatch');
  });
  it('no view: false, logged', () => {
    const log = vi.fn();
    expect(applyWidthChange(target, 30, false, log, () => null)).toBe(false);
    expect(String(log.mock.calls[0].join(' '))).toContain('no-view');
  });
  it('readOnly: no dispatch', () => {
    const { view, dispatch } = fakeView({ readOnly: true });
    const log = vi.fn();
    expect(applyWidthChange(target, 30, false, log, () => view)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
    expect(String(log.mock.calls[0].join(' '))).toContain('read-only');
  });
  it('not contentEditable: no dispatch', () => {
    const { view, dispatch } = fakeView({ editable: false });
    expect(applyWidthChange(target, 30, false, vi.fn(), () => view)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });
  it('dispatch throws: false, logged, does not throw', () => {
    const { view } = fakeView({ dispatch: () => { throw new Error('boom'); } });
    const log = vi.fn();
    expect(applyWidthChange(target, 30, false, log, () => view)).toBe(false);
    expect(String(log.mock.calls[0].join(' '))).toContain('error');
  });
});

describe('getMainEditorView', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  function addEditor(parent: HTMLElement, editable: boolean) {
    const { view } = fakeView({ editable });
    const el = document.createElement('div');
    el.className = 'cm-content';
    Object.defineProperty(el, 'contentEditable', { value: editable ? 'true' : 'false' });
    (view as { contentDOM: HTMLElement }).contentDOM = el;
    (el as unknown as { cmTile: unknown }).cmTile = { parent: { view } };
    parent.appendChild(el);
    return view;
  }
  it('returns null without .cm-content', () => expect(getMainEditorView(document)).toBeNull());
  it('returns null when cmTile is missing', () => {
    const el = document.createElement('div'); el.className = 'cm-content'; document.body.appendChild(el);
    expect(getMainEditorView(document)).toBeNull();
  });
  function scope(): HTMLElement {
    const s = document.createElement('div'); s.id = 'page-editor'; s.setAttribute('data-testid', 'page-editor');
    document.body.appendChild(s); return s;
  }
  it('does not use an editable view inside the old-revision view (id="page-editor" without data-testid)', () => {
    const ro = document.createElement('div'); ro.id = 'page-editor'; document.body.appendChild(ro);
    const inner = document.createElement('div'); inner.className = 'page-editor-editor-container'; ro.appendChild(inner);
    addEditor(inner, true);
    expect(getMainEditorView(document)).toBeNull();
  });
  it('does not use a single editable view outside the page editor scope', () => {
    addEditor(document.body, true);
    expect(getMainEditorView(document)).toBeNull();
  });
  it('returns the single editable view in scope, ignoring read-only ones', () => {
    const s = scope();
    addEditor(s, false);
    const v = addEditor(s, true);
    expect(getMainEditorView(document)).toBe(v);
  });
  it('falls back to tile.view', () => {
    const { view } = fakeView();
    const el = document.createElement('div'); el.className = 'cm-content';
    (view as { contentDOM: HTMLElement }).contentDOM = el;
    Object.defineProperty(el, 'contentEditable', { value: 'true' });
    (el as unknown as { cmTile: unknown }).cmTile = { view };
    scope().appendChild(el);
    expect(getMainEditorView(document)).toBe(view);
  });
  it('prefers the editor inside the page editor when several are editable', () => {
    const other = document.createElement('div'); document.body.appendChild(other);
    addEditor(other, true);
    const v = addEditor(scope(), true);
    expect(getMainEditorView(document)).toBe(v);
  });
  it('returns null when several are editable and none is distinguishable', () => {
    const s = scope();
    addEditor(s, true);
    addEditor(s, true);
    expect(getMainEditorView(document)).toBeNull();
  });
});
