// Load-error branch extracted from loadChannel (T-127). Kept in a separate
// file only because loadChannel is 351 LOC and the guard caps files at 300.
// This is one logical function split across two files; the branch order and
// every decision are preserved verbatim from the original catch block.
import { state } from './state.js';
import { deps } from './deps.js';
import { isRecoverable, isNativeLoadCrash } from './recovery.js';

export async function handleLoadError(error, myToken, channel) {
  clearInterval(state.loadingTimeout);
  state.loadingTimeout = null;
  if (myToken !== state.loadToken) return false;

  state.initialLoadPending = false;
  deps.showLoading(false);
  state.videoErrorCount = 0;

  if (error && error.code === 7000) return false;

  // After a timeout, the player was destroyed above. Recreate it so the
  // next channel switch works.
  if (error && (error.message === 'Load timed out' || error.name === 'DestroyedError')) {
    deps.logEvent('WARN', 'Load abandoned — recreating player for next attempt');
    const el = state.videoElement;
    await deps.destroyPlayer(el);
    if (el && myToken === state.loadToken) {
      await deps.initPlayer(el);
    }
    // #16: only the still-current tune may schedule its own retry.
    if (myToken === state.loadToken && state.reconnectAttempts < 3) {
      deps.scheduleReconnect();
    } else if (myToken === state.loadToken) {
      deps.showError(
        'Could not load this channel after several tries. It may be turned off or not available on your TV.',
      );
      deps.logEvent('ERROR', 'Reconnect limit reached — ' + (channel.name || channel.url.slice(0, 60)));
    }
    return false;
  }

  // Shaka could not guess the stream format from the URL (error 4000).
  // Many IPTV servers hide the channel type behind tokenized links with no
  // file extension. Probe the first bytes and retry with the right hint.
  if (error && error.code === 4000 && state.currentChannel && !state.sniffTriedUrls.has(state.currentChannel.url)) {
    state.sniffTriedUrls.add(state.currentChannel.url);
    const crashedChannel = state.currentChannel;
    const tokenAtCatch = state.loadToken;
    deps.probeChannelFormat(crashedChannel).then((mime) => {
      if (tokenAtCatch !== state.loadToken) return; // user switched channels meanwhile
      if (!mime) {
        deps.logEvent('WARN', 'Could not identify channel format: ' + crashedChannel.url.slice(0, 100));
        deps.showError('This channel could not be identified. Try a different channel.');
        return;
      }
      state.sniffedMimeUrls.set(crashedChannel.url, mime);
      deps.logEvent(
        'INFO',
        'Identified channel format: ' + mime + ' for ' + crashedChannel.url.slice(0, 80) + ' — retrying',
      );
      deps.loadChannel(crashedChannel);
    });
    return false;
  }

  if (isRecoverable(error)) {
    deps.logEvent('WARN', 'Load failed (recoverable ' + error.code + ')');
    if (state.reconnectAttempts < 3) {
      deps.scheduleReconnect();
    } else if (deps.shouldTryNative(error) && myToken === state.loadToken) {
      // Last resort: the native pipeline ignores CORS and survives relays
      // that defeat the browser stack (e.g. workers without ACAO headers).
      // Tried once — a native failure is recorded and never retried.
      deps.logEvent('WARN', 'Shaka retries exhausted — trying native playback');
      const okNative = await deps.switchToAvplay();
      if (myToken !== state.loadToken) return false;
      return okNative === true;
    } else {
      deps.showError(deps.getErrorMessage(error) + ' — channel may be turned off');
    }
    return false;
  }

  // BUG-017: tokenized servers reject loads with 403/401 when the token
  // went stale between playlist fetch and segment fetch. Every loadChannel()
  // refetches the master playlist (fresh token), so retry twice first.
  if (error && error.code === 1001 && state.currentChannel && state.reconnectAttempts < 2) {
    const status = error.data && error.data[1];
    if (status === 403 || status === 401) {
      deps.logEvent('WARN', 'Access denied at load (' + status + ') — retrying with fresh token');
      deps.scheduleReconnect();
      return false;
    }
  }

  if (isNativeLoadCrash(error) && state.currentChannel && !state.pdtFallbackUrls.has(state.currentChannel.url)) {
    // Retry once with HLS program-date-time sync disabled (BUG-013): some
    // HLS streams crash inside Shaka's PDT handling, which v1.7.0 enabled.
    state.pdtFallbackUrls.add(state.currentChannel.url);
    const crashedChannel = state.currentChannel;
    const tokenAtCatch = state.loadToken;
    deps.logEvent(
      'WARN',
      'Native crash loading channel — retrying without PDT sync: ' +
        (crashedChannel.name || crashedChannel.url.slice(0, 80)),
    );
    setTimeout(() => {
      if (tokenAtCatch === state.loadToken) deps.loadChannel(crashedChannel);
    }, 1200);
    return false;
  }

  if (isNativeLoadCrash(error)) {
    deps.logEvent(
      'ERROR',
      'Channel failed to load (native crash): ' +
        (state.currentChannel ? state.currentChannel.name + ' | ' + state.currentChannel.url.slice(0, 100) : '?') +
        ' — ' +
        (error.message || ''),
    );
    if (typeof console !== 'undefined') console.error('Channel load crashed inside Shaka:', error, error.stack);
    deps.showError(
      'This channel could not start — it uses a stream format this player could not handle. Try another channel.',
    );
    return false;
  }

  deps.logEvent('ERROR', 'Failed to load — ' + deps.getErrorMessage(error));
  deps.showError(deps.getErrorMessage(error));
  return false;
  return false;
}
