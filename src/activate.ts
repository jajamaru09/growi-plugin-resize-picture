import type { ComponentType } from 'react';
import { remarkResizePicture } from './remark-resize-picture';
import { rehypeResizePicture } from './rehype-resize-picture';
import { makeSizedImage } from './SizedImage';
import { injectStyles } from './styles';
import { applyWidthChange } from './editor-bridge';
import {
  PLUGIN_NAME, PLUGIN_LABEL,
  getHub, registerToHub, setEnabled, isPluginEnabled, log,
} from './hub';

declare const growiFacade: {
  markdownRenderer?: {
    optionsGenerators: {
      customGenerateViewOptions?: (...args: unknown[]) => Record<string, unknown>;
      generateViewOptions?: (...args: unknown[]) => Record<string, unknown>;
      customGeneratePreviewOptions?: (...args: unknown[]) => Record<string, unknown>;
      generatePreviewOptions?: (...args: unknown[]) => Record<string, unknown>;
    };
  };
} | undefined;

let wrappersInstalled = false;

function inject(options: Record<string, unknown>, context: 'view' | 'preview'): void {
  const remarkPlugins = (options.remarkPlugins ??= []) as unknown[];
  remarkPlugins.push([remarkResizePicture, { log }]);
  const rehypePlugins = (options.rehypePlugins ??= []) as unknown[];
  rehypePlugins.push([rehypeResizePicture, { context, log }]);

  const components = (options.components ??= {}) as Record<string, unknown>;
  const Original = (components.img ?? 'img') as ComponentType<any>;
  components.img = makeSizedImage(
    Original,
    context,
    context === 'preview' ? (t, w, a) => applyWidthChange(t, w, a, log) : undefined,
  );
  injectStyles();
}

function installWrappers(): void {
  if (wrappersInstalled) return;
  if (typeof growiFacade === 'undefined' || growiFacade?.markdownRenderer == null) return;
  const { optionsGenerators } = growiFacade.markdownRenderer;

  const origView = optionsGenerators.customGenerateViewOptions
    ?? optionsGenerators.generateViewOptions;
  if (origView) {
    optionsGenerators.customGenerateViewOptions = (...args: unknown[]) => {
      const options = origView(...args);
      if (!isPluginEnabled()) return options;
      inject(options, 'view');
      return options;
    };
  }

  const origPreview = optionsGenerators.customGeneratePreviewOptions
    ?? optionsGenerators.generatePreviewOptions;
  if (origPreview) {
    optionsGenerators.customGeneratePreviewOptions = (...args: unknown[]) => {
      const options = origPreview(...args);
      if (!isPluginEnabled()) return options;
      inject(options, 'preview');
      return options;
    };
  }

  wrappersInstalled = true;
}

export function activate(): void {
  setEnabled(true);
  installWrappers();
  registerToHub({
    id: PLUGIN_NAME,
    label: PLUGIN_LABEL,
    menuItem: false,
    onDisable: () => { setEnabled(false); log('disabled'); },
    onPageChange: () => { setEnabled(true); },
  });
  log('activated');
}

export function deactivate(): void {
  setEnabled(false);
  getHub()?.unregister?.(PLUGIN_NAME);
  log('deactivated');
}
