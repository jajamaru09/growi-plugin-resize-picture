export const PLUGIN_NAME = 'growi-plugin-resize-picture';
export const PLUGIN_LABEL = '画像のサイズ変更';

const HUB_SETTINGS_KEY = 'growiPluginHub:settings';

interface HubPluginState {
  registration: { id: string };
  status: 'active' | 'disabled' | 'error';
}

interface HubLike {
  register?: (plugin: unknown) => void;
  unregister?: (id: string) => void;
  log?: (pluginId: string, ...args: unknown[]) => void;
  _getPluginStates?: () => HubPluginState[];
  _queue?: unknown[];
}

export function getHub(): HubLike | undefined {
  return (window as unknown as { growiPluginHub?: HubLike }).growiPluginHub;
}

export function registerToHub(plugin: Record<string, unknown>): void {
  const w = window as unknown as { growiPluginHub?: HubLike };
  const hub = w.growiPluginHub;
  if (hub?.register) {
    hub.register(plugin);
    return;
  }
  w.growiPluginHub ??= { _queue: [] };
  ((w.growiPluginHub._queue ??= []) as unknown[]).push(plugin);
}

let enabled = true;

export function setEnabled(v: boolean): void {
  enabled = v;
}

export function isPluginEnabled(): boolean {
  if (enabled) return true; // fast path
  const me = getHub()?._getPluginStates?.().find(p => p.registration.id === PLUGIN_NAME);
  if (me?.status === 'active') {
    enabled = true;
    return true;
  }
  return false;
}

export function log(...args: unknown[]): void {
  const hub = getHub();
  if (hub?.log) {
    hub.log(PLUGIN_NAME, ...args);
    return;
  }
  // Fallback honoring hub's persisted debug settings (do NOT log unconditionally).
  try {
    const raw = localStorage.getItem(HUB_SETTINGS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { debug?: boolean; debugPlugins?: string[] };
    if (parsed.debug !== true) return;
    if (Array.isArray(parsed.debugPlugins) && parsed.debugPlugins.includes(PLUGIN_NAME)) return;
    console.log(`[${PLUGIN_NAME}]`, ...args);
  } catch {
    // localStorage unavailable or JSON parse error — stay silent
  }
}
