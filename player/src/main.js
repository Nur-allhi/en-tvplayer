// Thin entry point (T-152). The app hub wires every subsystem and boots it.
import './app/index.js';

// Preserve the old main.js public surface while callers migrate.
export { refreshChannels } from './app/channels.js';
