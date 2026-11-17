// Playback + display toggles (T-142). Moved verbatim from the playback branch
// of render() so the toggle persistence logic lives in its own slice. The
// BUG-011 regression (toggle not saved) is the acceptance criterion here.
import { saveSettings, getSettings } from '../config.js';
import { setConsented } from '../update.js';
import * as player from '../player/index.js';
import * as ui from '../ui/index.js';
import { deps } from './deps.js';

export function bindPlaybackToggles() {
  document.querySelectorAll('.toggle').forEach((t) => {
    t.addEventListener('click', function () {
      this.classList.toggle('on');
      if (this.id === 'toggle-autoq') {
        const enabled = this.classList.contains('on');
        saveSettings({ autoQuality: enabled });
        player.setAutoQuality(enabled);
      } else if (this.id === 'toggle-auto-refresh') {
        const enabled = this.classList.contains('on');
        saveSettings({ autoRefreshPlaylist: enabled });
      } else if (this.id === 'toggle-update-check') {
        const enabled = this.classList.contains('on');
        setConsented(enabled);
      } else if (this.id === 'toggle-watermark') {
        const enabled = this.classList.contains('on');
        saveSettings({ showWatermark: enabled });
        ui.setOverlayVisibility({ watermark: enabled });
      } else if (this.id === 'toggle-badge') {
        const enabled = this.classList.contains('on');
        saveSettings({ showResolutionBadge: enabled });
        ui.setOverlayVisibility({ badge: enabled });
      } else if (this.id === 'toggle-proxymenu') {
        const enabled = this.classList.contains('on');
        saveSettings({ showProxyMenu: enabled });
      } else if (this.id === 'toggle-channelsort') {
        const enabled = this.classList.contains('on');
        saveSettings({ channelSort: enabled ? 'provider' : 'name' });
      } else if (this.id.startsWith('show-group-')) {
        const idx = parseInt(this.id.slice('show-group-'.length), 10);
        const name = deps.groupNames()[idx];
        if (name) {
          const shown = this.classList.contains('on');
          const hidden = (getSettings().hiddenGroups || []).filter((g) => g !== name);
          if (!shown) hidden.push(name);
          saveSettings({ hiddenGroups: hidden });
        }
      }
    });
  });
}
