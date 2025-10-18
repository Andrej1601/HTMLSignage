// /admin/js/modules/backup.js
// =============================================================================
// Export- und Import-Interaktionen
// =============================================================================

'use strict';

import { notifyError, notifyInfo, notifySuccess } from '../core/notifications.js';

export function initBackupButtons({ fetchJson }) {
  const expBtn = document.getElementById('btnExport');
  const impFile = document.getElementById('importFile');
  const impWrite = document.getElementById('impWriteImg');

  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('importSuccess') === '1') {
      notifySuccess('Import abgeschlossen.');
      sessionStorage.removeItem('importSuccess');
    }
  } catch (error) {
    console.warn('[admin] Import-Status konnte nicht gelesen werden', error);
  }

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
        notifyInfo('Import läuft …');
        await fetchJson('/admin/api/import.php', {
          method: 'POST',
          body: fd,
          expectOk: true,
          errorMessage: 'Import fehlgeschlagen.'
        });
        notifySuccess('Import abgeschlossen. Oberfläche wird neu geladen …');
        try {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('importSuccess', '1');
          }
        } catch (error) {
          console.warn('[admin] Import-Status konnte nicht gespeichert werden', error);
        }
        await new Promise(resolve => setTimeout(resolve, 600));
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
