// Tizen platform compatibility feature (T-172). Contract: probe which APIs
// and engine the TV exposes so the rest of the app never reads platform globals
// directly. Pure capability decisions stay in lib/; this is the boundary the
// app imports for both halves.
export * from '../capabilities.js';
export * from '../lib/capabilities.js';
