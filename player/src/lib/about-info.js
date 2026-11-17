// Pure About-panel rows (T-192). Keeps version / engine / platform text out of
// the DOM-coupled settings slice so it can be tested without a TV.

export function aboutInfo({ version, caps, engine, nativeAvailable } = {}) {
  const isTizen = !!(caps && caps.isTizen);
  const engineName = engine === 'shaka' ? 'Shaka' : engine === 'native' ? 'Native' : 'Browser';
  const apiVersion =
    caps && caps.webApiVersion !== undefined && caps.webApiVersion !== null ? caps.webApiVersion : 'unknown';

  return [
    { label: 'App', value: 'EN IPTV Player' },
    { label: 'Version', value: version || 'unknown' },
    { label: 'Platform', value: isTizen ? 'Samsung Tizen' : 'Browser' },
    { label: 'TV API version', value: isTizen ? String(apiVersion) : 'Not a Tizen TV' },
    { label: 'Engine', value: engineName },
    { label: 'AVPlay', value: caps && caps.hasAvplay ? 'Available' : 'Not available' },
    { label: 'Native playback', value: nativeAvailable ? 'Available' : 'Not available' },
  ];
}
