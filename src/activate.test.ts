import { beforeEach, describe, expect, it, vi } from 'vitest';

const sanitizeStub = () => undefined;
const LightBoxStub = () => null;

type Gens = Record<string, ((...a: unknown[]) => any) | undefined>;
let gens: Gens;

const base = () => ({
  remarkPlugins: [],
  rehypePlugins: [sanitizeStub],
  components: { img: LightBoxStub },
});

function setup(pre: Gens = {}): Gens {
  gens = { generateViewOptions: base, generatePreviewOptions: base, ...pre };
  (globalThis as any).growiFacade = { markdownRenderer: { optionsGenerators: gens } };
  return gens;
}

async function load() {
  const { activate, deactivate } = await import('./activate');
  const { remarkResizePicture } = await import('./remark-resize-picture');
  const { rehypeResizePicture } = await import('./rehype-resize-picture');
  return { activate, deactivate, remarkResizePicture, rehypeResizePicture };
}

const registered = (): any => (window as any).growiPluginHub._queue.at(-1);

beforeEach(() => {
  vi.resetModules();
  delete (window as any).growiPluginHub;
  localStorage.clear();
  setup();
});

describe('activate', () => {
  it.each([['view', 'customGenerateViewOptions'], ['preview', 'customGeneratePreviewOptions']])(
    'injects plugins at the end and wraps img for %s',
    async (context, key) => {
      const { activate, remarkResizePicture, rehypeResizePicture } = await load();
      activate();
      const o = gens[key]!();
      expect(o.remarkPlugins.at(-1)).toEqual([remarkResizePicture, expect.any(Object)]);
      expect(o.rehypePlugins[0]).toBe(sanitizeStub);
      expect(o.rehypePlugins.at(-1)).toEqual([
        rehypeResizePicture,
        expect.objectContaining({ context }),
      ]);
      expect(o.components.img).not.toBe(LightBoxStub);
      expect(typeof o.components.img).toBe('function');
    },
  );

  it('chains an existing custom generator', async () => {
    setup({ customGenerateViewOptions: () => ({ ...base(), rehypePlugins: ['prev'] }) });
    const { activate, rehypeResizePicture } = await load();
    activate();
    expect(gens.customGenerateViewOptions!().rehypePlugins).toEqual([
      'prev',
      [rehypeResizePicture, expect.any(Object)],
    ]);
  });

  it('creates missing arrays and wraps a plain img when components.img is absent', async () => {
    setup({ generateViewOptions: () => ({}) });
    const { activate } = await load();
    activate();
    const o = gens.customGenerateViewOptions!();
    expect(o.remarkPlugins).toHaveLength(1);
    expect(o.rehypePlugins).toHaveLength(1);
    expect(typeof o.components.img).toBe('function');
  });

  it('passes through untouched when disabled by hub', async () => {
    const { activate } = await load();
    activate();
    registered().onDisable();
    for (const k of ['customGenerateViewOptions', 'customGeneratePreviewOptions']) {
      const o = gens[k]!();
      expect(o.remarkPlugins).toEqual([]);
      expect(o.rehypePlugins).toEqual([sanitizeStub]);
      expect(o.components.img).toBe(LightBoxStub);
    }
  });

  it('re-enables on page change', async () => {
    const { activate } = await load();
    activate();
    registered().onDisable();
    registered().onPageChange();
    expect(gens.customGenerateViewOptions!().remarkPlugins).toHaveLength(1);
  });

  it('registers with menuItem false', async () => {
    const { activate } = await load();
    activate();
    expect(registered()).toMatchObject({
      id: 'growi-plugin-resize-picture',
      label: '画像のサイズ変更',
      menuItem: false,
    });
  });

  it('does not install wrappers twice', async () => {
    const { activate } = await load();
    activate();
    activate();
    expect(gens.customGenerateViewOptions!().remarkPlugins).toHaveLength(1);
  });

  it('passes through after deactivate', async () => {
    const { activate, deactivate } = await load();
    activate();
    deactivate();
    expect(gens.customGenerateViewOptions!().rehypePlugins).toEqual([sanitizeStub]);
  });
});
