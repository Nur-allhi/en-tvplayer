// In-app What's New entries (T-152b). Moved verbatim out of main.js so the
// What's New slice and the T-153 release script can share the one source.

export const CHANGELOG = [
  {
    version: '3.2.0',
    sections: [
      {
        type: 'fixed',
        items: [
          'Raw TS links play via the TV built-in player instead of looping',
          'CORS-blocked relays fall back to native playback',
          'Expired live segments re-sync instead of stopping playback',
          'Clear messages for undecodable or over-quality channels',
          'Expired links refetch a fresh URL instead of retrying forever',
          'Dead channels stop with a message instead of freezing the app',
          'Smoother auto quality on slow relays',
          'Cleaner tune screen: one status line, instant cut on switch',
          'Tip: if a channel misses after fast switching, select it again',
          'Fast channel switching plays the final channel reliably',
          'Stuck channels resume on their own; slow relays restart less',
          'Channels start playing sooner',
        ],
      },
    ],
  },
  {
    version: '3.1.0',
    sections: [
      {
        type: 'added',
        items: ['Remembers your last group and channel — reopening the app replays what you were watching'],
      },
      {
        type: 'fixed',
        items: [
          'Channel list focus stays visible while scrolling with the button held',
          'Reload no longer strands you on the logo when stream links went stale — the last channel is retried with fresh links',
        ],
      },
    ],
  },
  {
    version: '3.0.4',
    sections: [
      {
        type: 'fixed',
        items: [
          'Protected channels with cookie login (Star Plus HD and similar) play again — channel key loading fixed',
        ],
      },
    ],
  },
  {
    version: '3.0.3',
    sections: [
      { type: 'added', items: ['Audio track selection in the right sidebar for multi-audio channels'] },
      { type: 'fixed', items: ['Cookie-protected channels (JioTV+ Business, Devotional) now play'] },
    ],
  },
  {
    version: '3.0.2',
    sections: [
      { type: 'added', items: ['Channel name under the center logo while buffering'] },
      { type: 'changed', items: ['Single center logo — stacked logos impossible'] },
      { type: 'fixed', items: ['Slow connects show progress instead of a bare logo'] },
    ],
  },
  {
    version: '3.0.1',
    sections: [{ type: 'fixed', items: ['Buffering hints now show above the pill, larger and centered'] }],
  },
  {
    version: '3.0.0',
    sections: [
      {
        type: 'added',
        items: [
          'Xtream login source with Test Login',
          'First-run source picker for new installs',
          'Channel Up/Down buttons switch to the next/previous channel',
        ],
      },
    ],
  },
  {
    version: '2.3.0',
    sections: [
      {
        type: 'added',
        items: [
          'Provider-order channel listing by default, A–Z stays optional',
          'Hide groups from Settings, cross-group channel search from the group list',
        ],
      },
    ],
  },
  {
    version: '2.2.0',
    sections: [
      {
        type: 'added',
        items: [
          'Channel Source revamp: 3 playlists max, side-by-side cards with added and last-played dates',
          'OK on a card loads it immediately, Left/Right moves across cards',
          'TV keyboard opens from playlist inputs, fetch button relabeled Active',
          'Display toggles: App logo and Quality badge can be shown or hidden',
        ],
      },
      { type: 'fixed', items: ['Settings side-nav spacing, header to top, bigger white title'] },
    ],
  },
  {
    version: '2.1.0',
    sections: [
      {
        type: 'added',
        items: [
          'Custom stream headers via #KODIPROP (User-Agent, Referer, Authorization)',
          'Multi-key DRM decryption for protected channels',
        ],
      },
      { type: 'fixed', items: ['Update checker now actually runs — opt in once, get notified of new versions'] },
    ],
  },
  {
    version: '2.0.0',
    sections: [
      {
        type: 'added',
        items: [
          'Slide-in watermark once the sidebar hides',
          'Stream type in the quality badge (e.g. M3U8, MPD)',
          'Rounded rows and white focus rings everywhere',
        ],
      },
      {
        type: 'changed',
        items: [
          'New tune sequence: spinner + name, then bottom status pill',
          'Deep lists scroll without jumping',
          'Streamlined Settings, staged splash',
        ],
      },
      { type: 'fixed', items: ['Playing row stays marked on reopen', 'Upstream blips no longer restart playback'] },
    ],
  },
  {
    version: '1.10.1',
    sections: [
      {
        type: 'fixed',
        items: [
          'Empty fresh install no longer strands you on a dead page',
          'Resolution badge always shows the true quality',
          'Interlaced channels play via native fallback',
          'Flaky relays recover instead of dying (fresh-token retries)',
        ],
      },
      {
        type: 'changed',
        items: [
          'Staged loading: spinner, first frame, then buffering',
          'Channel + buffering toasts with wait hints',
          'Boot logo flies toward you on launch',
        ],
      },
    ],
  },
  {
    version: '1.10.0',
    sections: [
      {
        type: 'added',
        items: [
          'Optional update checker — opt in once, get notified of new versions',
          'Contact and download stats refreshed',
        ],
      },
    ],
  },
  {
    version: '1.9.0',
    sections: [
      {
        type: 'fixed',
        items: [
          'Tokenized live playlists now play without dropping after the first frame',
          'Access-denied channels retry with a fresh link before giving up',
          'Clearer messages when a live stream breaks up',
        ],
      },
    ],
  },
  {
    version: '1.8.0',
    sections: [
      {
        type: 'fixed',
        items: [
          'Settings changes via remote now save — playlist edits and toggles stick',
          'Enter inside Settings text boxes now saves on TV',
          'Crashing channels retry automatically in compatibility mode',
          'Unrecognized channel links are now identified and retried correctly',
          'Channel error messages are now accurate (including access-denied detection)',
        ],
      },
      { type: 'changed', items: ['Proxy hint position fixed to bottom center', 'Settings back button spacing fixed'] },
    ],
  },
  {
    version: '1.7.0',
    sections: [
      {
        type: 'fixed',
        items: [
          'Black screen on some IPTV channels — now detects stream format automatically',
          'HLS streams that need date-time sync now work correctly',
          'Raw TS/MP4 stream URLs now play correctly on Samsung Tizen',
          'Video errors from the TV are now caught and shown to you',
          'Streams that will never work now fail in 15 seconds instead of 30',
        ],
      },
      {
        type: 'changed',
        items: [
          'All error messages are now in plain English — no more technical jargon',
          'Better error hints (try Proxy, check internet, channel may be offline)',
        ],
      },
    ],
  },
  {
    version: '1.6.0',
    sections: [
      {
        type: 'added',
        items: [
          'Boot splash with logo animation, typewriter tagline, and spinner',
          'App version displayed on splash screen',
          'What\u2019s New modal shown once after each update',
          'Auto-refresh playlist on app launch — toggle in Settings → Playback',
        ],
      },
      {
        type: 'fixed',
        items: [
          'Fetch Active intermittent error during stream playback',
          'Relay fallback now shows meaningful error messages',
          'Fetch Active button disables during loading',
        ],
      },
    ],
  },
  {
    version: '1.5.0',
    sections: [{ type: 'changed', items: ['Updated app logo with new design'] }],
  },
  {
    version: '1.4.0',
    sections: [
      { type: 'added', items: ['Channel name auto-scroll for long names'] },
      { type: 'fixed', items: ['Sidebar navigation and channel switching improvements'] },
    ],
  },
  {
    version: '1.3.0',
    sections: [{ type: 'added', items: ['Responsive TV scaling for all screen sizes'] }],
  },
];
