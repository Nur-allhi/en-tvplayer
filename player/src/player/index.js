// Player public API (T-123). Pure re-export hub: the 24 names player.js used
// to expose are unchanged, so main.js and settings.js keep calling player.*
// exactly as before. Only the five slices that own public names are listed;
// internal slices (dom, watchdog, recover, native, probe) wire their own deps
// slots at module load and are imported through those slices' dependencies.
// Internal slices expose no public names but must still be evaluated so their
// self-wiring Object.assign(deps, ...) runs before any playback call.
import './dom.js';
import './watchdog.js';
import './recover.js';
import './native.js';
import './probe.js';

export * from './init.js';
export * from './load.js';
export * from './events.js';
export * from './stream.js';
export * from './controls.js';
