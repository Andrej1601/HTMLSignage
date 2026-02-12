export const stateStore = {
  getSchedule: () => null,
  setSchedule: () => {},
  getSettings: () => null,
  setSettings: () => {},
  getBaseState: () => ({ schedule: null, settings: null }),
  setBaseState: () => {},
  getDeviceBaseState: () => ({ schedule: null, settings: null }),
  setDeviceBaseState: () => {},
  clearDeviceBaseState: () => {},
  getDeviceContext: () => null,
  setDeviceContext: () => {},
  clearDeviceContext: () => {},
  getCurrentView: () => 'grid',
  setCurrentView: () => {},
  isDevicesPinned: () => false,
  setDevicesPinned: () => {},
  getDockPane: () => null,
  setDockPane: () => {},
  getDevicesPane: () => null,
  setDevicesPane: () => {}
};

export function registerStateAccess(overrides = {}) {
  Object.assign(stateStore, overrides);
}
