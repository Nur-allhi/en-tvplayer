// Feature: cross-group search.
//
// Contract (T-172): owns #channel-search and #search-results and the 'search'
// remote action. The DOM implementation remains in ui/search.js for now —
// moving it here would need features → ui state/deps imports, which breaks the
// one-way import rule (main → app → player|ui|settings|features → lib|state).
// This descriptor is the declared integration point; T-173 routes the action.

export const contract = {
  id: 'search',
  owns: ['#channel-search', '#search-results'],
  routes: ['search'],
  menuEntries: [],
};

export default contract;
