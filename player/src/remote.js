let onKeyAction = null;
let numberBuffer = '';
let numberTimeout = null;

export function init(callback) {
  onKeyAction = callback;

  document.addEventListener('keydown', handleKeyDown, true);
}

export function destroy() {
  document.removeEventListener('keydown', handleKeyDown, true);
  onKeyAction = null;
}

function handleKeyDown(e) {
  if (!onKeyAction) return;

  const key = e.key || e.keyCode;

  // When settings is visible, handle arrow navigation + back
  const settingsPage = document.getElementById('settings-page');
  const isSettingsVisible = settingsPage && !settingsPage.classList.contains('hidden');
  if (isSettingsVisible) {
    const activeEl = document.activeElement;
    const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

    if (isInputFocused) {
      if (key === 'ArrowUp' || e.keyCode === 38) {
        e.preventDefault();
        e.stopPropagation();
        onKeyAction('up');
        return;
      }
      if (key === 'ArrowDown' || e.keyCode === 40) {
        e.preventDefault();
        e.stopPropagation();
        onKeyAction('down');
        return;
      }
      if (key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        e.stopPropagation();
        onKeyAction('select');
        return;
      }
      return;
    }

    if (key === 'Escape' || key === 'Backspace' || e.keyCode === 27 || e.keyCode === 10009) {
      e.preventDefault();
      e.stopPropagation();
      onKeyAction('back');
      return;
    }
    if (key === 'Enter' || e.keyCode === 13) {
      e.preventDefault();
      e.stopPropagation();
      onKeyAction('select');
      return;
    }
    if (key === 'ArrowUp' || e.keyCode === 38) {
      e.preventDefault();
      e.stopPropagation();
      onKeyAction('up');
      return;
    }
    if (key === 'ArrowDown' || e.keyCode === 40) {
      e.preventDefault();
      e.stopPropagation();
      onKeyAction('down');
      return;
    }
    if (key === 'ArrowLeft' || e.keyCode === 37) {
      e.preventDefault();
      e.stopPropagation();
      onKeyAction('left');
      return;
    }
    if (key === 'ArrowRight' || e.keyCode === 39) {
      e.preventDefault();
      e.stopPropagation();
      onKeyAction('right');
      return;
    }
    return;
  }

  // Sidebar channel search: let typing and caret keys reach the input.
  // Only Enter/Escape/arrows are captured for result navigation. Backspace
  // deletes on desktop but exits on TV (the Tizen IME deletes internally).
  const searchInput = document.getElementById('channel-search');
  const isSearchTyping = searchInput && document.activeElement === searchInput;
  if (isSearchTyping) {
    const isTV = typeof window !== 'undefined' && !!(window.tizen && window.tizen.tvinputdevice);
    if (key === 'Enter' || e.keyCode === 13) {
      e.preventDefault();
      e.stopPropagation();
      onKeyAction('select');
      return;
    }
    if (key === 'Escape' || key === 'GoBack' || e.keyCode === 27 || e.keyCode === 10009) {
      e.preventDefault();
      e.stopPropagation();
      onKeyAction('back');
      return;
    }
    if (isTV && (key === 'Backspace' || e.keyCode === 8)) {
      e.preventDefault();
      e.stopPropagation();
      onKeyAction('back');
      return;
    }
    if (key === 'ArrowUp' || e.keyCode === 38) {
      e.preventDefault();
      e.stopPropagation();
      onKeyAction('up');
      return;
    }
    if (key === 'ArrowDown' || e.keyCode === 40) {
      e.preventDefault();
      e.stopPropagation();
      onKeyAction('down');
      return;
    }
    return;
  }

  // Prevent default for handled keys
  const handled = [
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Enter', 'Escape', 'Backspace', ' ',
    'r', 'R',
    'ChUp', 'ChDown', 'ChannelUp', 'ChannelDown', 'GoBack',
    'MediaPlayPause', 'MediaStop',
    'MediaTrackPrevious', 'MediaTrackNext',
    'MediaFastForward', 'MediaRewind',
    'ColorRed', 'ColorGreen', 'ColorYellow', 'ColorBlue',
    'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue',
    'MediaPlay', 'MediaPause',
    37, 38, 39, 40, 13, 27, 32, 82, 10009, // keyCodes
    427, 428, // CH Up / CH Down (Tizen keyCodes)
  ];

  if (handled.includes(key) || handled.includes(e.keyCode)) {
    e.preventDefault();
  }

  // Samsung remote special keys (some TVs use these)
  const samsungKeys = {
    'ColorRed': 'red',
    'ColorGreen': 'green',
    'ColorYellow': 'yellow',
    'ColorBlue': 'blue',
    'ColorF0Red': 'red',
    'ColorF1Green': 'green',
    'ColorF2Yellow': 'yellow',
    'ColorF3Blue': 'blue',
    'MediaPlayPause': 'playpause',
    'MediaPlay': 'play',
    'MediaPause': 'pause',
    'MediaStop': 'stop',
    'MediaTrackNext': 'next',
    'MediaTrackPrevious': 'prev',
    'MediaFastForward': 'next',
    'MediaRewind': 'prev',
    'ChUp': 'channelUp',
    'ChDown': 'channelDown',
    'ChannelUp': 'channelUp',
    'ChannelDown': 'channelDown',
    'VolumeUp': 'volumeUp',
    'VolumeDown': 'volumeDown',
    'VolumeMute': 'mute',
  };

  // Arrow keys
  if (key === 'ArrowUp' || e.keyCode === 38) {
    onKeyAction('up');
    return;
  }
  if (key === 'ArrowDown' || e.keyCode === 40) {
    onKeyAction('down');
    return;
  }
  if (key === 'ArrowLeft' || e.keyCode === 37) {
    onKeyAction('left');
    return;
  }
  if (key === 'ArrowRight' || e.keyCode === 39) {
    onKeyAction('right');
    return;
  }

  // Channel Up/Down (CH keys): real Tizen hardware often reports these as
  // keyCode-only (427/428) with e.key 'Unidentified', so match both.
  if (key === 'ChUp' || key === 'ChannelUp' || e.keyCode === 427) {
    onKeyAction('channelUp');
    return;
  }
  if (key === 'ChDown' || key === 'ChannelDown' || e.keyCode === 428) {
    onKeyAction('channelDown');
    return;
  }

  // Enter / OK
  if (key === 'Enter' || e.keyCode === 13) {
    onKeyAction('select');
    return;
  }

  // Back / Escape (10009 = Tizen GoBack)
  if (key === 'Escape' || key === 'Backspace' || key === 'GoBack' || e.keyCode === 27 || e.keyCode === 10009) {
    onKeyAction('back');
    return;
  }

  // Play/Pause (space or media key)
  if (key === ' ' || e.keyCode === 32) {
    onKeyAction('playpause');
    return;
  }

  // Samsung special keys
  if (samsungKeys[key]) {
    onKeyAction(samsungKeys[key]);
    return;
  }

  // Number keys (0-9)
  if (/^[0-9]$/.test(key)) {
    handleNumberInput(key);
    return;
  }

  // Also handle keyCode for number keys (some remotes)
  if (e.keyCode >= 48 && e.keyCode <= 57) {
    const num = e.keyCode - 48;
    handleNumberInput(String(num));
    return;
  }

  // R / r — force-reload the current channel
  if (key === 'r' || key === 'R' || e.keyCode === 82) {
    onKeyAction('reload');
    return;
  }
}

function handleNumberInput(num) {
  numberBuffer += num;

  // Clear previous timeout
  if (numberTimeout) {
    clearTimeout(numberTimeout);
  }

  // Wait 500ms for more digits, then jump to channel
  numberTimeout = setTimeout(() => {
    if (onKeyAction && numberBuffer) {
      onKeyAction('number', parseInt(numberBuffer, 10));
    }
    numberBuffer = '';
  }, 500);
}
