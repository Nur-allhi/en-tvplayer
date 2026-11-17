// Search feature (T-172). Contract: the ui/sidebar renders the search row and
// the remote router sends up/down/select/back while a search is active. The
// implementation stays in ui/search.js; this module is the feature boundary
// so app/index.js no longer needs to know which slice owns the behaviour.
export { enterSearch, exitSearch, searchNavigate, searchSelect } from '../ui/search.js';
