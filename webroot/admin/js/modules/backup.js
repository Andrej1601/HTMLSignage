// /admin/js/modules/backup.js
// =============================================================================
// Export- und Import-Interaktionen
// =============================================================================

'use strict';

import { notifyError, notifySuccess } from '../core/notifications.js';

export function initBackupButtons({ fetchJson }) {
  const expBtn = document.getElementById('btnExport');
  const impFile = document.getElementById('importFile');
  const impWrite = document.getElementById('impWriteImg');

  if (expBtn) {
    expBtn.onclick = () => {
      const incImg = document.getElementById('expWithImg')?.checked ? 1 : 0;
      const incSet = document.getElementById('expWithSettings')?.checked ? 1 : 0;
      const incSch = document.getElementById('expWithSchedule')?.checked ? 1 : 0;
      const stamp = new Date().toISOString().slice(0, 10);
      const url = `/admin/api/export.php?include=${incImg}&settings=${incSet}&schedule=${incSch}&name=${encodeURIComponent('signage_export_' + stamp)}`;
      window.location.assign(url);
    };
  }

  if (impFile) {
    impFile.onchange = async () => {
      if (!impFile.files || !impFile.files[0]) return;
      const fd = new FormData();
      fd.append('file', impFile.files[0]);
      fd.append('writeAssets', impWrite?.checked ? '1' : '0');
      fd.append('writeSettings', document.getElementById('impWriteSettings')?.checked ? '1' : '0');
      fd.append('writeSchedule', document.getElementById('impWriteSchedule')?.checked ? '1' : '0');
      try {
        await fetchJson('/admin/api/import.php', {
          method: 'POST',
          body: fd,
          expectOk: true,
          errorMessage: 'Import fehlgeschlagen.'
        });
        notifySuccess('Import erfolgreich.');
        location.reload();
      } catch (error) {
        console.error('[admin] Import fehlgeschlagen', error);
        notifyError('Fehler: ' + error.message);
      } finally {
        try {
          impFile.value = '';
        } catch (e) {
          console.warn('[admin] Import-Dateifeld konnte nicht zurückgesetzt werden', e);
        }
      }
    };
  }
}
