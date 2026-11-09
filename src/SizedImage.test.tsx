import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { makeSizedImage } from './SizedImage';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const Original = (props: any) => (
  <button className="orig" data-extra={props['data-extra']}><img alt={props.alt} src={props.src} /></button>
);

let host: HTMLDivElement;
let root: Root;
let outer: HTMLDivElement;
// 既定ではページのエディタ（[data-testid="page-editor"]）の中に描画する。
// 'readonly' は古い版の画面（id="page-editor" だけがあり data-testid が無い）を模す
function mount(where: boolean | 'readonly') {
  outer = document.createElement('div');
  if (where !== false) outer.id = 'page-editor';
  if (where === true) outer.setAttribute('data-testid', 'page-editor');
  host = document.createElement('div');
  outer.appendChild(host);
  document.body.appendChild(outer);
  root = createRoot(host);
}
beforeEach(() => mount(true));
afterEach(() => { act(() => root.unmount()); outer.remove(); });

function render(el: React.ReactElement) { act(() => { root.render(el); }); }
const q = (s: string) => host.querySelector(s) as HTMLElement | null;

function stub(container: number, natural: number, displayed: number) {
  const frame = q('.grw-plugin-resize-picture-frame')!;
  frame.parentElement!.getBoundingClientRect = () => ({ width: container } as DOMRect);
  frame.getBoundingClientRect = () => ({ width: displayed } as DOMRect);
  Object.defineProperty(frame.querySelector('img')!, 'naturalWidth', { value: natural, configurable: true });
}
// jsdom には PointerEvent が無いので、MouseEvent に pointerId を足して代用する
const ptr = (type: string, x: number, button = 0, pointerId = 1) => {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, button });
  Object.defineProperty(ev, 'pointerId', { value: pointerId });
  return ev;
};
function drag(handle: HTMLElement, from: number, to: number) {
  act(() => { handle.dispatchEvent(ptr('pointerdown', from)); });
  act(() => { handle.dispatchEvent(ptr('pointermove', to)); });
  act(() => { handle.dispatchEvent(ptr('pointerup', to)); });
}
const previewProps = { src: 'a.png', alt: 'a', 'data-extra': 'x', 'data-rp-start': '0', 'data-rp-end': '12' };
const HANDLE = '.grw-plugin-resize-picture-handle';

describe('SizedImage', () => {
  it('view: 幅があれば枠に幅を付け、props を渡し、ハンドルは無い', () => {
    const S = makeSizedImage(Original, 'view');
    render(<S {...previewProps} data-rp-width="50" />);
    const frame = q('.grw-plugin-resize-picture-frame')!;
    expect(frame.style.width).toBe('50%');
    expect(frame.querySelector('.orig')!.getAttribute('data-extra')).toBe('x');
    expect(q(HANDLE)).toBeNull();
  });
  it('view: 幅が無ければ枠なし', () => {
    const S = makeSizedImage(Original, 'view');
    render(<S src="a.png" alt="a" />);
    expect(q('.grw-plugin-resize-picture-frame')).toBeNull();
    expect(q('.orig')).not.toBeNull();
  });
  it('preview: ハンドルがあり、幅が無ければ枠に width を付けない', () => {
    const S = makeSizedImage(Original, 'preview', vi.fn(() => true));
    render(<S {...previewProps} />);
    expect(q(HANDLE)).not.toBeNull();
    expect(q('.grw-plugin-resize-picture-frame')!.style.width).toBe('');
  });
  it('preview: onResize か位置が無ければハンドルなし', () => {
    const S = makeSizedImage(Original, 'preview');
    render(<S {...previewProps} />);
    expect(q(HANDLE)).toBeNull();
    const S2 = makeSizedImage(Original, 'preview', vi.fn(() => true));
    render(<S2 src="a.png" />);
    expect(q(HANDLE)).toBeNull();
  });
  it('preview: ドラッグで onResize が 1 回呼ばれる', () => {
    const onResize = vi.fn(() => true);
    const S = makeSizedImage(Original, 'preview', onResize);
    render(<S {...previewProps} />);
    stub(800, 1600, 800);
    drag(q(HANDLE)!, 500, 300);
    expect(onResize).toHaveBeenCalledTimes(1);
    expect(onResize).toHaveBeenCalledWith({ start: 0, end: 12 }, 75, false);
  });
  it('preview: コメント位置と幅も span に入る', () => {
    const onResize = vi.fn(() => true);
    const S = makeSizedImage(Original, 'preview', onResize);
    render(<S {...previewProps} data-rp-width={50} data-rp-comment-start={12} data-rp-comment-end={19} />);
    stub(800, 1600, 400);
    drag(q(HANDLE)!, 0, 100);
    expect(onResize).toHaveBeenCalledWith(
      { start: 0, end: 12, commentStart: 12, commentEnd: 19, width: 50 }, 60, false);
  });
  it('preview: 原寸が小さければ atLimit', () => {
    const onResize = vi.fn(() => true);
    const S = makeSizedImage(Original, 'preview', onResize);
    render(<S {...previewProps} />);
    stub(800, 300, 200);
    drag(q(HANDLE)!, 0, 600);
    expect((onResize.mock.calls[0] as unknown[])[2]).toBe(true);
  });
  it('preview: 動かさなければ onResize を呼ばない', () => {
    const onResize = vi.fn(() => true);
    const S = makeSizedImage(Original, 'preview', onResize);
    render(<S {...previewProps} />);
    stub(800, 1600, 800);
    drag(q(HANDLE)!, 5, 5);
    expect(onResize).not.toHaveBeenCalled();
  });
  it('ドラッグ直後の click は止められ、通常の click は届く', () => {
    const S = makeSizedImage(Original, 'preview', vi.fn(() => true));
    render(<S {...previewProps} />);
    stub(800, 1600, 800);
    const onBtn = vi.fn();
    q('.orig')!.addEventListener('click', onBtn);
    const plain = new MouseEvent('click', { bubbles: true, cancelable: true });
    act(() => { q('.orig')!.dispatchEvent(plain); });
    expect(onBtn).toHaveBeenCalledTimes(1);
    expect(plain.defaultPrevented).toBe(false);

    drag(q(HANDLE)!, 500, 300);
    const after = new MouseEvent('click', { bubbles: true, cancelable: true });
    act(() => { q('.orig')!.dispatchEvent(after); });
    expect(after.defaultPrevented).toBe(true);
    expect(onBtn).toHaveBeenCalledTimes(1);
  });

  it('pointercancel では onResize を呼ばず、幅を props の値に戻す', () => {
    const onResize = vi.fn(() => true);
    const S = makeSizedImage(Original, 'preview', onResize);
    render(<S {...previewProps} data-rp-width="50" />);
    stub(800, 1600, 400);
    const h = q(HANDLE)!;
    act(() => { h.dispatchEvent(ptr('pointerdown', 500)); });
    act(() => { h.dispatchEvent(ptr('pointermove', 300)); });
    expect(q('.grw-plugin-resize-picture-frame')!.style.width).toBe('200px');
    act(() => { h.dispatchEvent(ptr('pointercancel', 300)); });
    act(() => { h.dispatchEvent(ptr('pointerup', 300)); });
    expect(onResize).not.toHaveBeenCalled();
    expect(q('.grw-plugin-resize-picture-frame')!.style.width).toBe('50%');
  });
  it('onResize が true ならドラッグ後の幅を保ち、false なら props の幅に戻す', () => {
    for (const [ret, expected] of [[true, '75%'], [false, '50%']] as const) {
      const S = makeSizedImage(Original, 'preview', vi.fn(() => ret));
      render(<S {...previewProps} data-rp-width="50" />);
      stub(800, 1600, 400);
      drag(q(HANDLE)!, 0, 200);
      expect(q('.grw-plugin-resize-picture-frame')!.style.width).toBe(expected);
    }
  });
  it('naturalWidth が 0 ならドラッグを始めない', () => {
    const onResize = vi.fn(() => true);
    const S = makeSizedImage(Original, 'preview', onResize);
    render(<S {...previewProps} />);
    stub(800, 0, 400);
    const down = ptr('pointerdown', 0);
    act(() => { q(HANDLE)!.dispatchEvent(down); });
    expect(down.defaultPrevented).toBe(false);
    act(() => { q(HANDLE)!.dispatchEvent(ptr('pointermove', 200)); });
    act(() => { q(HANDLE)!.dispatchEvent(ptr('pointerup', 200)); });
    expect(onResize).not.toHaveBeenCalled();
  });
  it('主ボタン以外では始めず、別の pointerId は無視する', () => {
    const onResize = vi.fn(() => true);
    const S = makeSizedImage(Original, 'preview', onResize);
    render(<S {...previewProps} />);
    stub(800, 1600, 800);
    const h = q(HANDLE)!;
    act(() => { h.dispatchEvent(ptr('pointerdown', 0, 2)); });
    act(() => { h.dispatchEvent(ptr('pointermove', -200)); });
    act(() => { h.dispatchEvent(ptr('pointerup', -200)); });
    expect(onResize).not.toHaveBeenCalled();
    act(() => { h.dispatchEvent(ptr('pointerdown', 0)); });
    const other = ptr('pointerup', -200, 0, 2);
    act(() => { h.dispatchEvent(ptr('pointermove', -200)); });
    act(() => { h.dispatchEvent(other); });
    expect(onResize).not.toHaveBeenCalled();
    act(() => { h.dispatchEvent(ptr('pointerup', -200)); });
    expect(onResize).toHaveBeenCalledTimes(1);
  });
  it('バッジ: 開始時は今の %、原寸が上限なら「原寸」', () => {
    const S = makeSizedImage(Original, 'preview', vi.fn(() => true));
    render(<S {...previewProps} />);
    stub(800, 300, 200);
    const h = q(HANDLE)!;
    const badge = q('.grw-plugin-resize-picture-badge')!;
    act(() => { h.dispatchEvent(ptr('pointerdown', 0)); });
    expect(badge.textContent).toBe('25%');
    act(() => { h.dispatchEvent(ptr('pointermove', 50)); });
    expect(badge.textContent).toBe('30%');
    act(() => { h.dispatchEvent(ptr('pointermove', 600)); });
    expect(badge.textContent).toBe('原寸');
    act(() => { h.dispatchEvent(ptr('pointerup', 600)); });
  });
  it('data-rp-width が変わると style を props の値に戻す', () => {
    const S = makeSizedImage(Original, 'preview', vi.fn(() => true));
    render(<S {...previewProps} data-rp-width="50" />);
    const frame = q('.grw-plugin-resize-picture-frame')!;
    frame.style.width = '123px';
    render(<S {...previewProps} data-rp-width="60" />);
    expect(frame.style.width).toBe('60%');
    frame.style.width = '123px';
    render(<S {...previewProps} />);
    expect(frame.style.width).toBe('');
  });
  it('preview: #page-editor の外（モーダル等）ではハンドルを出さず、ドラッグしても onResize を呼ばない', () => {
    act(() => root.unmount()); outer.remove();
    mount(false);
    const onResize = vi.fn(() => true);
    const S = makeSizedImage(Original, 'preview', onResize);
    render(<S {...previewProps} />);
    expect(q(HANDLE)).toBeNull();
    expect(onResize).not.toHaveBeenCalled();
  });
  it('preview: 古い版の画面（id="page-editor" だけで data-testid が無い）ではハンドルを出さない', () => {
    act(() => root.unmount()); outer.remove();
    mount('readonly');
    const onResize = vi.fn(() => true);
    const S = makeSizedImage(Original, 'preview', onResize);
    render(<S {...previewProps} />);
    expect(q(HANDLE)).toBeNull();
  });
  it('preview: pointerdown 時にもページのエディタの外なら何もしない', () => {
    const onResize = vi.fn(() => true);
    const S = makeSizedImage(Original, 'preview', onResize);
    render(<S {...previewProps} />);
    stub(800, 1600, 800);
    const handle = q(HANDLE)!;
    outer.removeAttribute('data-testid'); // マウント後にエディタ外へ移った場合
    drag(handle, 500, 300);
    expect(onResize).not.toHaveBeenCalled();
  });
  it('preview: span.src が data-rp-src から入る', () => {
    const onResize = vi.fn(() => true);
    const S = makeSizedImage(Original, 'preview', onResize);
    render(<S {...previewProps} data-rp-src="![a](/x.png)" />);
    stub(800, 1600, 800);
    drag(q(HANDLE)!, 500, 300);
    expect(onResize).toHaveBeenCalledWith({ start: 0, end: 12, src: '![a](/x.png)' }, 75, false);
  });
});
