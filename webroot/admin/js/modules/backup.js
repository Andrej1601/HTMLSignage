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
  const impProgress = document.getElementById('importProgress');
  const impProgressFill = impProgress?.querySelector('[data-role="progress-fill"]');
  const impProgressLabel = document.getElementById('importProgressLabel');

  let progressTimer = 0;
  let progressValue = 0;

  const applyProgressScale = (value) => {
    if (!impProgressFill) return;
    const clamped = Math.max(0, Math.min(100, value));
    impProgressFill.style.setProperty('--progress-scale', String(clamped / 100));
  };

  const setProgressStatus = (status) => {
    if (!impProgress) return;
    if (status) {
      impProgress.dataset.status = status;
    } else {
      delete impProgress.dataset.status;
    }
  };

  const setProgressLabel = (text) => {
    if (impProgressLabel && typeof text === 'string') {
      impProgressLabel.textContent = text;
    }
  };

  const stopProgressTimer = () => {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = 0;
    }
  };

  const showProgress = (message) => {
    if (!impProgress) return;
    impProgress.hidden = false;
    setProgressStatus('');
    progressValue = 0;
    applyProgressScale(0);
    setProgressLabel(message || 'Import wird vorbereitet …');
    stopProgressTimer();
    progressTimer = setInterval(() => {
      if (progressValue >= 92) return;
      const step = Math.random() * 6 + 4;
      progressValue = Math.min(92, progressValue + step);
      applyProgressScale(progressValue);
    }, 420);
  };

  const settleProgress = (status, message, { delay = 1400 } = {}) => {
    if (!impProgress) return;
    stopProgressTimer();
    if (typeof message === 'string') {
      setProgressLabel(message);
    }
    if (status) {
      setProgressStatus(status);
    }
    applyProgressScale(100);
    if (delay > 0) {
      setTimeout(() => {
        if (!impProgress) return;
        impProgress.hidden = true;
        setProgressStatus('');
        applyProgressScale(0);
      }, delay);
    } else {
      impProgress.hidden = true;
      setProgressStatus('');
      applyProgressScale(0);
    }
  };

  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('importSuccess') === '1') {
      notifySuccess('Import erfolgreich abgeschlossen.');
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
        notifyInfo('Import gestartet – bitte nicht schließen.');
        showProgress('Import wird übertragen …');
        await fetchJson('/admin/api/import.php', {
          method: 'POST',
          body: fd,
          expectOk: true,
          errorMessage: 'Import fehlgeschlagen.'
        });
        settleProgress('success', 'Import erfolgreich abgeschlossen. Oberfläche wird neu geladen …', { delay: 800 });
        notifySuccess('Import abgeschlossen – Daten wurden übernommen. Oberfläche wird neu geladen …');
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
        settleProgress('error', 'Import fehlgeschlagen. Bitte prüfen Sie die Datei.', { delay: 2000 });
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
