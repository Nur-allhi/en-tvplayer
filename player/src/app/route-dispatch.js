// Feature-route dispatch (T-173). Pure and DOM-free: the caller owns view
// precedence, this only answers "does an enabled feature own this action?".

import { getEnabledRoutes } from './plugins.js';

export function dispatchFeatureRoute(action, value) {
  const route = getEnabledRoutes()[action];
  if (!route) return false;
  route(value);
  return true;
}
