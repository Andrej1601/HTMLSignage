/**
 * Local storage wrapper with graceful fallback handling.
 *
 * @module core/storage
 */

import { createSafeLocalStorage } from './safe_storage.js';
import { notifyWarning } from './notifications.js';

const safeStorage = createSafeLocalStorage({
  onFallback: () => {
    notifyWarning({
      message: 'Speicher voll – Daten werden nur temporär gespeichert.',
      description: 'Bitte Speicherplatz freigeben oder Einstellungen exportieren, um Datenverlust zu vermeiden.',
      persistent: true,
      actions: [
        {
          label: 'Neu laden',
          onClick: () => {
            window.location.reload();
          }
        }
      ]
    });
  },
  logger: (method, error) => console.warn(`[admin] localStorage.${method} failed`, error)
});

/**
 * Small helper around the safe storage instance.
 * @typedef {Object} StorageAdapter
 * @property {(key: string) => string|null} get
 * @property {(key: string, value: string) => void} set
 * @property {(key: string) => void} remove
 */

/**
 * Shared storage adapter used across the admin UI.
 * @type {StorageAdapter}
 */
export const storage = {
  get: (key) => safeStorage.getItem(key),
  set: (key, value) => safeStorage.setItem(key, value),
  remove: (key) => safeStorage.removeItem(key)
};

export default storage;
