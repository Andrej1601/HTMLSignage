/**
 * Central application state container for the admin UI.
 *
 * @module core/app_state
 */

/**
 * @typedef {Object} DeviceContext
 * @property {string|null} id
 * @property {string|null} name
 * @property {import('./config.js').BadgeMeta|null} badge
 */

/**
 * @typedef {Object} AppStateApi
 * @property {() => any} getSchedule
 * @property {(next: any) => void} setSchedule
 * @property {() => any} getSettings
 * @property {(next: any) => void} setSettings
 * @property {(schedule: any, settings: any) => void} setBaseState
 * @property {() => {schedule: any, settings: any}} getBaseState
 * @property {(schedule: any, settings: any) => void} setDeviceBaseState
 * @property {() => {schedule: any, settings: any}} getDeviceBaseState
 * @property {() => void} clearDeviceBaseState
 * @property {(ctx: DeviceContext) => void} setDeviceContext
 * @property {() => DeviceContext} getDeviceContext
 * @property {() => void} clearDeviceContext
 * @property {(view: 'grid'|'preview') => void} setCurrentView
 * @property {() => 'grid'|'preview'} getCurrentView
 * @property {(flag: boolean) => void} setDevicesPinned
 * @property {() => boolean} isDevicesPinned
 * @property {(el: HTMLElement|null) => void} setDockPane
 * @property {() => HTMLElement|null} getDockPane
 * @property {(el: HTMLElement|null) => void} setDevicesPane
 * @property {() => HTMLElement|null} getDevicesPane
 */

/**
 * Creates a state container that keeps track of schedule, settings, device
 * context and UI preferences.
 *
 * @param {Object} [options]
 * @param {'grid'|'preview'} [options.initialView='grid']
 * @param {boolean} [options.devicesPinned=false]
 * @returns {AppStateApi}
 */
export function createAppState(options = {}) {
  const initialView = options.initialView === 'preview' ? 'preview' : 'grid';
  const state = {
    schedule: null,
    settings: null,
    baseSchedule: null,
    baseSettings: null,
    deviceBaseSchedule: null,
    deviceBaseSettings: null,
    deviceCtx: null,
    deviceName: null,
    deviceBadge: null,
    currentView: initialView,
    devicesPinned: !!options.devicesPinned,
    dockPane: null,
    devicesPane: null
  };

  /** @type {AppStateApi} */
  const api = {
    getSchedule: () => state.schedule,
    setSchedule: (next) => { state.schedule = next; },
    getSettings: () => state.settings,
    setSettings: (next) => { state.settings = next; },
    setBaseState: (schedule, settings) => {
      state.baseSchedule = schedule;
      state.baseSettings = settings;
    },
    getBaseState: () => ({ schedule: state.baseSchedule, settings: state.baseSettings }),
    setDeviceBaseState: (schedule, settings) => {
      state.deviceBaseSchedule = schedule;
      state.deviceBaseSettings = settings;
    },
    getDeviceBaseState: () => ({ schedule: state.deviceBaseSchedule, settings: state.deviceBaseSettings }),
    clearDeviceBaseState: () => {
      state.deviceBaseSchedule = null;
      state.deviceBaseSettings = null;
    },
    setDeviceContext: ({ id, name, badge }) => {
      state.deviceCtx = id || null;
      state.deviceName = name || null;
      state.deviceBadge = badge || null;
    },
    getDeviceContext: () => ({
      id: state.deviceCtx,
      name: state.deviceName,
      badge: state.deviceBadge
    }),
    clearDeviceContext: () => {
      state.deviceCtx = null;
      state.deviceName = null;
      state.deviceBadge = null;
    },
    setCurrentView: (view) => {
      state.currentView = view === 'preview' ? 'preview' : 'grid';
    },
    getCurrentView: () => state.currentView,
    setDevicesPinned: (flag) => { state.devicesPinned = !!flag; },
    isDevicesPinned: () => state.devicesPinned,
    setDockPane: (el) => { state.dockPane = el || null; },
    getDockPane: () => state.dockPane,
    setDevicesPane: (el) => { state.devicesPane = el || null; },
    getDevicesPane: () => state.devicesPane
  };

  return api;
}

export default createAppState;
