# FILE_SPLIT_PLAN.md — BUG-002 File Splitting Plan

> **Goal:** Split all files exceeding 300 LOC into smaller, focused modules.
> **Rule:** Only move code, never modify logic. Test after each phase.

---

## Current Status

| File | LOC | Over Limit? | Target LOC |
|------|-----|-------------|------------|
| ui.js | 838 | ❌ +538 | ≤ 300 each |
| settings.js | 713 | ❌ +413 | ≤ 300 each |
| main.js | 665 | ❌ +365 | ≤ 300 each |
| player.js | 610 | ❌ +310 | ≤ 300 each |
| remote.js | 212 | ✅ | — |
| utils.js | 173 | ✅ | — |
| config.js | 109 | ✅ | — |

---

## Phase 1: ui.js Split

**File:** `player/src/ui.js` (838 LOC)
**Risk:** Medium — Many exports, clear groupings
**Estimated Time:** 30-45 minutes

### Target Structure

| New File | LOC | Contents |
|----------|-----|----------|
| `ui.js` | ~300 | Core init, channel list, navigation, sidebar |
| `sidebar.js` | ~150 | Sidebar toggle, group list, channel groups |
| `rightmenu.js` | ~200 | Right sidebar, proxy, resolution, quality |
| `dialog.js` | ~100 | Confirm dialog system |
| `osd.js` | ~100 | Channel OSD, buffering indicator |

### Functions to Move

#### sidebar.js
- `extractGroups(channelList)`
- `renderGroupList()`
- `updateGroupFocus()`
- `navigateGroupUp()`
- `navigateGroupDown()`
- `selectFocusedGroup()`
- `showGroupChannels(groupName)`
- `showGroupList()`

#### rightmenu.js
- `applyRightSidebar()`
- `setAutoCloseCallback(callback)`
- `toggleRightSidebar()`
- `isRightSidebarOpen()`
- `setProxyToggleCallback(cb)`
- `toggleCurrentChannelProxy()`
- `updateProxyButtonText()`
- `setResolutionCallback(cb)`
- `setResolutions(heights)`
- `setSelectedResolution(value)`
- `rightSidebarNavigateUp()`
- `rightSidebarNavigateDown()`
- `rightSidebarSelect()`

#### dialog.js
- `isDialogOpen()`
- `showConfirmDialog(message, onConfirm, onCancel)`
- `hideConfirmDialog()`
- `dialogNavigate(dir)`
- `dialogSelect()`

#### osd.js
- `showChannelOsd(channel)`
- `showBuffering(percent)`
- `updateBuffering(percent)`
- `hideBuffering()`
- `showProxyToast()`
- `hideProxyToast()`

### ui.js (Remaining)
- `init(channelList, callback)`
- `getSidebarMode()`
- `getGroups()`
- `getSelectedGroup()`
- `getCurrentIndex()`
- `renderChannelList()`
- `selectChannel(index, skipFullscreen)`
- `navigateUp()`
- `navigateDown()`
- `selectFocused()`
- `getDisplayChannels()`
- `jumpToNumber(num, skipFullscreen)`
- `toggleSidebar()`
- `closeAllOverlays()`
- `isSidebarOpen()`
- `showSidebarWithContent()`
- `isFullscreenMode()`
- `requestFullscreen()`
- `exitFullscreenMode()`
- `stopCursorAutoHide()`
- `startInactivityTimer()`
- `stopInactivityTimer()`
- `resetInactivityTimer()`
- `getChannels()`
- `getCurrentChannel()`
- `refreshChannelList(newChannels)`

### Re-export Strategy

```javascript
// ui.js — Re-export everything for backward compatibility
export * from './sidebar.js';
export * from './rightmenu.js';
export * from './dialog.js';
export * from './osd.js';

// Keep original exports here
export function init(...) { ... }
export function toggleSidebar() { ... }
// ...
```

### Test Checklist
- [ ] Build succeeds (`npm run build`)
- [ ] Bundle size reasonable
- [ ] All exports available from `ui.js`
- [ ] Sidebar opens/closes
- [ ] Group list works
- [ ] Right sidebar works
- [ ] Dialog appears/disappears
- [ ] Channel OSD shows
- [ ] Buffering indicator works

---

## Phase 2: settings.js Split

**File:** `player/src/settings.js` (713 LOC)
**Risk:** Low — Clear split between nav and rendering
**Estimated Time:** 20-30 minutes

### Target Structure

| New File | LOC | Contents |
|----------|-----|----------|
| `settings.js` | ~200 | Main exports, init, navigation |
| `settings-nav.js` | ~250 | Focus management, keyboard nav |
| `settings-render.js` | ~260 | HTML rendering, event handlers |

### Functions to Move

#### settings-nav.js
- `navigate(dir)`
- `navigateNav(dir)`
- `selectFocused()`
- `buildFocusOrder()`
- `clearFocus()`
- `applyFocus()`

#### settings-render.js
- `render()`
- `renderSourceCard(s, lastFetched)`
- `renderConnectionCard(s)`
- `renderPlaybackCard()`
- `renderAboutCard()`
- `handleFetch()`
- `handleProxySave()`
- `timeAgo(isoString)`

### settings.js (Remaining)
- `init(settingsContainer, callbacks)`
- `show()`
- `hide()`
- `isVisible()`
- Local state variables

### Test Checklist
- [ ] Build succeeds
- [ ] Settings page opens
- [ ] Navigation works
- [ ] Playlist add/edit/delete works
- [ ] Fetch button works
- [ ] Proxy settings save
- [ ] Playback settings toggle

---

## Phase 3: main.js Split

**File:** `player/src/main.js` (665 LOC)
**Risk:** Medium — Circular dependencies possible
**Estimated Time:** 30-45 minutes

### Target Structure

| New File | LOC | Contents |
|----------|-----|----------|
| `main.js` | ~200 | Init, boot flow, player setup |
| `handlers.js` | ~250 | Remote control, action routing |
| `utils-main.js` | ~215 | Helpers (progress, badges, refresh) |

### Functions to Move

#### handlers.js
- `handleRemoteAction(action, value)`
- `registerTizenKeys()`
- `handleChannelSelect(channel)`

#### utils-main.js
- `getResolutionLabel(height)`
- `formatBandwidth(bps)`
- `updateResolutionBadge(height, bandwidth)`
- `showProgress(text)`
- `updateProgressPercent(percent)`
- `hideProgress()`
- `refreshChannelsInBackground()`
- `refreshChannels()`
- `sortChannels(ch)`
- `applyProxyOverrides(channels)`
- `getDisplayChannels()`

### main.js (Remaining)
- `init()`
- `startPlayer()`
- `showFirstLaunch()`
- `showPlayer()`
- `hidePlayer()`
- `showSettingsPage()`
- `cleanupEventListeners()`
- `addCleanupListener()`

### Test Checklist
- [ ] Build succeeds
- [ ] App boots correctly
- [ ] Remote control works
- [ ] Channel switching works
- [ ] Settings page opens
- [ ] Progress indicators work
- [ ] Resolution badge shows

---

## Phase 4: player.js Split

**File:** `player/src/player.js` (610 LOC)
**Risk:** Low — Clear separation of concerns
**Estimated Time:** 20-30 minutes

### Target Structure

| New File | LOC | Contents |
|----------|-----|----------|
| `player.js` | ~200 | Core player, init, load, play |
| `stream.js` | ~200 | Track info, quality, resolution |
| `drm.js` | ~210 | DRM support, EME, key systems |

### Functions to Move

#### stream.js
- `getActiveTrack()`
- `getActiveHeight()`
- `getActiveBandwidth()`
- `getResolutions()`
- `selectResolution(height)`
- `getVideoElement()`
- `onTrackChange(callback)`

#### drm.js
- `isEmeSupported()`
- DRM configuration constants
- License server handling

### player.js (Remaining)
- `initPlayer(videoEl)`
- `loadChannel(channel)`
- `togglePlay()`
- `stop()`
- `reloadChannel()`
- `getPlayer()`
- `getBufferingPercent()`
- `onBuffering(callback)`
- `onChannelAdvance(callback)`
- `onProxySuggestion(callback)`
- `setAutoQuality(enabled)`

### Test Checklist
- [ ] Build succeeds
- [ ] Video plays
- [ ] DRM channels work
- [ ] Quality selection works
- [ ] Auto quality works
- [ ] Channel advance works
- [ ] Proxy suggestion works

---

## Safety Rules

### DO
- ✅ Work on `dev` branch only
- ✅ Test after each phase
- ✅ Re-export everything for backward compatibility
- ✅ Keep all functionality identical
- ✅ Use `git checkout -b fix/phase-N` for each phase

### DON'T
- ❌ Modify any logic
- ❌ Change function signatures
- ❌ Remove any exports
- ❌ Skip testing
- ❌ Merge to main without confirmation

---

## Progress Tracking

| Phase | Status | Branch | Tested | Merged to dev |
|-------|--------|--------|--------|---------------|
| 1: ui.js | ⏳ Pending | — | — | — |
| 2: settings.js | ⏳ Pending | — | — | — |
| 3: main.js | ⏳ Pending | — | — | — |
| 4: player.js | ⏳ Pending | — | — | — |

---

## Rollback Plan

If any phase breaks the app:

1. `git checkout dev`
2. `git branch -D fix/phase-N`
3. App is back to previous working state
4. Investigate what went wrong
5. Try again with different approach

---

## Final Verification

After all phases complete:

1. Full build test
2. Fresh install test
3. Playlist fetch test
4. Channel playback test
5. Settings navigation test
6. DRM channel test
7. Remote control test
8. Bundle size check
