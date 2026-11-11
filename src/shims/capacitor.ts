/**
 * Web-only stand-in for `@capacitor/core`. The ported portal code only asks
 * "are we on a native shell?" — on this dashboard the answer is always no.
 */
export const Capacitor = {
  isNativePlatform: () => false,
  getPlatform: () => 'web',
};
