// DOM and logging helpers (T-123).
import { deps } from './deps.js';
import { state } from './state.js';

export function logEvent(level, message) {
  try {
    if (typeof console !== 'undefined' && console.debug) {
      const safe = typeof message === 'string' ? message.replace(/(https?:\/\/[^\s'"]+?)[?#][^\s'"]*/g, '$1') : message;
      console.debug('[app][' + level + ']', safe);
    }
  } catch {}
}

export function showLoading(show) {
  const el = document.getElementById('loading');
  if (el) el.classList.toggle('hidden', !show);
  const spinner = el ? el.querySelector('.spinner') : null;
  if (spinner) spinner.classList.toggle('hidden', !show);
}

export function hideLoading() {
  const el = document.getElementById('loading');
  if (el) el.classList.add('hidden');
}

export function showPlayState(paused) {
  const el = document.getElementById('play-state');
  if (el) {
    el.classList.toggle('hidden', !paused);
  }
}

export function showError(message) {
  hideLoading();
  const el = document.getElementById('error');
  if (el) {
    el.textContent = message;
    el.classList.remove('hidden');
  }
}

export function hideError() {
  const el = document.getElementById('error');
  if (el) {
    el.classList.add('hidden');
  }
}

export function getErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try another channel.';

  const code = error.code;

  // Simple, non-technical messages users can understand and report back
  const messages = {
    1000: 'This channel link uses a type your TV cannot open.',
    1001: 'The channel server rejected the request. It may be blocking this app right now.',
    1002: 'Could not connect to the channel stream. The server may be down or blocking the app right now.',
    1003: 'The channel took too long to respond. It may be slow or turned off right now.',
    1004: 'This channel link is not valid.',
    1005: 'This channel link is not valid.',
    7000: 'Channel loading was interrupted.',
    2000: 'This channel contains text data the app could not read.',
    2001: 'This channel contains text data the app could not read.',
    2002: 'This channel contains text data the app could not read.',
    2003: 'This channel contains text with an unknown encoding.',
    2004: 'This channel contains text data that could not be decoded.',
    2005: 'This channel contains data that could not be read.',
    2006: 'This channel contains captions the app could not read.',
    6000: 'This channel uses a protection type that is not recognized.',
    6001: 'This channel is protected and your TV cannot play protected channels.',
    6002: 'Could not set up playback for this channel. Please restart the app and try again.',
    6007: 'This channel is protected but the key could not be obtained.',
    6020: 'This channel is protected and your TV does not support this type of protection.',
    3000: 'This channel could not play on your TV.',
    3001: 'This channel uses stream values your TV could not process.',
    3002: 'This channel could not play on your TV.',
    3003: 'This channel could not play on your TV.',
    3016: 'This channel could not be decoded on your TV. Try a different channel.',
    3017: 'This channel is too high quality for this TV. Try a lower-quality channel.',
    3018: 'The live stream broke up. Trying again — if it persists, try another channel.',
    4000: 'This channel could not be identified. Try a different channel.',
    4032: 'This channel stopped playing in a format your TV accepts. Trying again — if it persists, try another channel.',
  };

  // BAD_HTTP_STATUS (1001): the real HTTP status is in error.data[1].
  if (code === 1001) {
    const status = error.data && error.data[1];
    if (status === 403) return 'This channel is not allowed to play. You may need a subscription or different access.';
    if (status === 401)
      return 'This channel is not allowing access right now. Its link may have expired — try again in a bit.';
    if (status === 404) return 'This channel was not found. The link may have changed.';
    if (typeof status === 'number' && status >= 500)
      return 'The channel server is having problems. Please try again later.';
    if (typeof status === 'number' && status)
      return 'Channel returned an error (code ' + status + '). Please try again.';
    if (status) return 'Could not load this channel. Please try again.';
    return 'The channel server rejected the request. It may be blocking this app right now.';
  }

  if (messages[code]) {
    return messages[code];
  }

  if (error.message) {
    return error.message.substring(0, 100);
  }

  return 'Something went wrong (error ' + code + '). Please try another channel or restart the app.';
}

export function showTerminal(error) {
  logEvent(
    'ERROR',
    'Unrecoverable error ' +
      error.code +
      ' (' +
      (state.currentChannel && state.currentChannel.name ? state.currentChannel.name : 'unknown') +
      ') — ' +
      getErrorMessage(error),
  );
  showError(getErrorMessage(error));
}

export function showTuneElapsed(name, seconds) {
  const veil = document.getElementById('loading');
  const nameEl = document.getElementById('loading-name');
  if (veil && nameEl && !veil.classList.contains('hidden')) {
    nameEl.textContent = (name || 'Loading') + ' • ' + seconds + 's';
  }
}

// This slice wires its own deps slots. The hub only assembles the API.
Object.assign(deps, {
  logEvent,
  showLoading,
  showPlayState,
  showError,
  hideError,
  getErrorMessage,
  showTerminal,
  showTuneElapsed,
});
