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
    const delSauna = confirm('Sauna-Bilder löschen? OK = Ja, Abbrechen = Nein');
    const delInter = confirm('Medien-Slides löschen? OK = Ja, Abbrechen = Nein');
    const delFlame = confirm('Flammen-Bild löschen? OK = Ja, Abbrechen = Nein');

    const qs = new URLSearchParams({
      sauna: delSauna ? '1' : '0',
      inter: delInter ? '1' : '0',
      flame: delFlame ? '1' : '0'
    });

    try {
      const result = await fetchJson('/admin/api/cleanup_assets.php?' + qs.toString(), {
        okPredicate: (data) => data?.ok !== false,
        errorMessage: 'Bereinigung fehlgeschlagen.'
      });
      const removed = result?.removed ?? '?';
      notifySuccess(`Bereinigt: ${removed} Dateien entfernt.`);
    } catch (error) {
      console.error('[admin] Asset-Bereinigung fehlgeschlagen', error);
      notifyError('Fehler: ' + error.message);
    }
  };
}
