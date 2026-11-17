// AVPlay fallback feature (T-172). Contract: `avplay` is the native playback
// surface used when the browser cannot decode a stream, and `native` owns the
// URL rewrite and the switch decision. Both implementations stay where they
// are; this is the single module the app imports to talk to the feature.
export * from '../avplay.js';
export * from '../player/native.js';
