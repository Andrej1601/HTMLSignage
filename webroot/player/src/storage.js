export function createSafeLocalStorage({ onFallback, logger } = {}) {
  const memory = {};
  let fallbackTriggered = false;
  let store = null;

  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      store = globalThis.localStorage;
    } else if (typeof window !== 'undefined' && window.localStorage) {
      store = window.localStorage;
    }
  } catch (error) {
    store = null;
  }

  const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const notifyFallback = () => {
    if (fallbackTriggered) return;
    fallbackTriggered = true;
    if (typeof onFallback === 'function') onFallback();
  };
  const reportFailure = (method, error) => {
    if (error) {
      if (typeof logger === 'function') logger(method, error);
      else console.warn(`[slideshow] localStorage.${method} failed`, error);
    }
    notifyFallback();
  };

  return {
    get(key) {
      if (store) {
        try {
          return store.getItem(key);
        } catch (error) {
          reportFailure('getItem', error);
        }
      }
      return hasOwn(memory, key) ? memory[key] : null;
    },
    set(key, value) {
      if (store) {
        try {
          store.setItem(key, value);
          if (hasOwn(memory, key)) delete memory[key];
          return;
        } catch (error) {
          reportFailure('setItem', error);
        }
      }
      memory[key] = String(value);
    },
    remove(key) {
      if (store) {
        try {
          store.removeItem(key);
        } catch (error) {
          reportFailure('removeItem', error);
        }
      }
      delete memory[key];
    }
  };
}
