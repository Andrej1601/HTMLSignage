// /admin/js/core/safe_storage.js
// Resiliente localStorage-Hülle mit Speicher-Fallback.

'use strict';

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function resolveStore() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      return globalThis.localStorage;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch (err) {
    /* no-op */
  }
  return null;
}

export function createSafeLocalStorage({ onFallback, logger } = {}) {
  const memory = Object.create(null);
  const store = resolveStore();
  let fallbackTriggered = false;

  const notifyFallback = (method, error) => {
    if (fallbackTriggered) return;
    fallbackTriggered = true;
    if (typeof logger === 'function') {
      try {
        logger(method, error);
      } catch (logError) {
        console.warn('[admin] localStorage logger failed', logError);
      }
    } else if (error) {
      console.warn(`[admin] localStorage.${method} failed`, error);
    }
    if (typeof onFallback === 'function') {
      try {
        onFallback(error);
      } catch (callbackError) {
        console.warn('[admin] localStorage fallback handler failed', callbackError);
      }
    }
  };

  return {
    getItem(key) {
      if (store) {
        try {
          return store.getItem(key);
        } catch (error) {
          notifyFallback('getItem', error);
        }
      }
      return hasOwn(memory, key) ? memory[key] : null;
    },
    setItem(key, value) {
      if (store) {
        try {
          store.setItem(key, value);
          if (hasOwn(memory, key)) delete memory[key];
          return;
        } catch (error) {
          notifyFallback('setItem', error);
        }
      }
      memory[key] = String(value);
    },
    removeItem(key) {
      if (store) {
        try {
          store.removeItem(key);
        } catch (error) {
          notifyFallback('removeItem', error);
        }
      }
      if (hasOwn(memory, key)) delete memory[key];
    },
    clearMemory() {
      for (const key of Object.keys(memory)) {
        delete memory[key];
      }
    },
    isFallbackActive() {
      return fallbackTriggered;
    }
  };
}

export default createSafeLocalStorage;
