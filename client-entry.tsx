import { activate, deactivate } from './src/activate';
import { PLUGIN_NAME } from './src/hub';

type Activators = Record<string, { activate: () => void; deactivate: () => void }>;
const w = window as unknown as { pluginActivators?: Activators };

if (w.pluginActivators == null) {
  w.pluginActivators = {};
}
w.pluginActivators[PLUGIN_NAME] = { activate, deactivate };
