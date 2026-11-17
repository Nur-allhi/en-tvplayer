// Shared app state, one object (Risk C). Only the fields the boot slice needs
// for this ticket; other slices add theirs when they are extracted.
export const state = {
  bootTypewriterTimer: null,
  bootShownAt: 0,
  bootTypewriterEnd: 0,
};
