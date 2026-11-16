// Confirm-dialog slice (T-131). Self-contained by design: it depends on no
// other UI module, only the DOM. `ui.js` re-exports these five names so every
// caller (exit, delete playlist, update notice) keeps using the same API.

let dialogOpen = false;
let dialogConfirmCallback = null;
let dialogCancelCallback = null;
let dialogFocus = 0;

export function isDialogOpen() {
  return dialogOpen;
}

export function showConfirmDialog(message, onConfirm, onCancel) {
  dialogOpen = true;
  dialogConfirmCallback = onConfirm;
  dialogCancelCallback = onCancel;
  dialogFocus = 1;
  const el = document.getElementById('confirm-dialog');
  const msgEl = document.getElementById('confirm-dialog-message');
  if (msgEl) msgEl.textContent = message;
  if (el) el.classList.remove('hidden');
  updateDialogFocus();
}

export function hideConfirmDialog() {
  dialogOpen = false;
  dialogConfirmCallback = null;
  dialogCancelCallback = null;
  const el = document.getElementById('confirm-dialog');
  if (el) el.classList.add('hidden');
}

export function dialogNavigate(dir) {
  if (!dialogOpen) return;
  dialogFocus = (dialogFocus + dir + 2) % 2;
  updateDialogFocus();
}

export function dialogSelect() {
  if (!dialogOpen) return;
  const isConfirm = dialogFocus === 1;
  const cb = isConfirm ? dialogConfirmCallback : dialogCancelCallback;
  hideConfirmDialog();
  if (cb) cb(isConfirm);
}

function updateDialogFocus() {
  const cancelBtn = document.getElementById('confirm-dialog-cancel');
  const confirmBtn = document.getElementById('confirm-dialog-confirm');
  if (cancelBtn) cancelBtn.classList.toggle('focused', dialogFocus === 0);
  if (confirmBtn) confirmBtn.classList.toggle('focused', dialogFocus === 1);
}
