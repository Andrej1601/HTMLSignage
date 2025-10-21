// /admin/js/modules/system_cleanup.js
// =============================================================================
// Systemwerkzeuge für Asset-Aufräumaktionen
// =============================================================================

'use strict';

import { notifyError, notifySuccess } from '../core/notifications.js';

export function initCleanupInSystem({ fetchJson }) {
  const btn = document.getElementById('btnCleanupSys');
  if (!btn) return;

  btn.onclick = async () => {
    const confirmed = confirm('Nicht verwendete Medien löschen? Aktive Dateien bleiben erhalten.');
    if (!confirmed) return;

    const qs = new URLSearchParams({ mode: 'unused' });

    try {
      btn.disabled = true;
      const result = await fetchJson('/admin/api/cleanup_assets.php?' + qs.toString(), {
        okPredicate: (data) => data?.ok !== false,
        errorMessage: 'Bereinigung fehlgeschlagen.'
      });
      const removedList = Array.isArray(result?.removed) ? result.removed : [];
      const removedCount = Number.isInteger(result?.count) ? result.count : removedList.length;
      const message = removedCount === 0
        ? 'Bereinigt: Keine Dateien entfernt.'
        : `Bereinigt: ${removedCount} Datei${removedCount === 1 ? '' : 'en'} entfernt.`;
      notifySuccess(message);
    } catch (error) {
      console.error('[admin] Asset-Bereinigung fehlgeschlagen', error);
      notifyError('Fehler: ' + error.message);
    } finally {
      btn.disabled = false;
    }
  };
}
