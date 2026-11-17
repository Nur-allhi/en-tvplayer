// Search feature (T-172). The ui/sidebar renders the search row and the remote
// router sends up/down/select/back while a search is active. The DOM
// implementation stays in ui/search.js; this module is the declared boundary
// so app/index.js no longer needs to know which slice owns the behaviour.

export const contract = {
  id: 'search',
  owns: ['#channel-search', '#search-results'],
  routes: ['search'],
  menuEntries: [],
};

export default contract;

export { enterSearch, exitSearch, searchNavigate, searchSelect } from '../ui/search.js';
