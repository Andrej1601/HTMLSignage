import { Router, type NextFunction, type Response } from 'express';
import { createReadStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomBytes } from 'crypto';
import multer from 'multer';
import archiver from 'archiver';
import type { AuthRequest } from '../lib/auth.js';
import { authMiddleware, requireRole } from '../lib/auth.js';
import { logAuditEvent, createAuditRequestSnapshot } from '../lib/audit.js';
import {
  buildBackupExportManifest,
  buildImportPreview,
  getBackupOperationFailure,
  importBackupArchive,
  parseReplaceMedia,
  type BackupOperationFailure,
} from '../lib/systemBackup.js';
import { createSystemJob, findRunningSystemJob, runSystemJob } from '../lib/systemJobs.js';
import { UPLOAD_DIR } from '../lib/upload.js';

const router = Router();

const backupUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, os.tmpdir()),
    filename: (_req, file, cb) => {
      const suffix = `${Date.now()}-${randomBytes(8).toString('hex')}`;
      const ext = path.extname(file.originalname || '') || '.zip';
      cb(null, `htmlsignage-backup-${suffix}${ext}`);
    },
  }),
  limits: {
    fileSize: 1024 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const lowerName = (file.originalname || '').toLowerCase();
    const isZip = lowerName.endsWith('.zip')
      || file.mimetype === 'application/zip'
      || file.mimetype === 'application/x-zip-compressed'
      || (file.mimetype === 'application/octet-stream' && lowerName.endsWith('.zip'));

    if (isZip) {
      cb(null, true);
      return;
    }

    cb(new Error('Nur ZIP-Backups sind erlaubt.'));
  },
});

const backupUploadMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  backupUpload.fields([
    { name: 'backup', maxCount: 1 },
    { name: 'backupFile', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ])(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    const message = error instanceof Error ? error.message : 'Backup-Datei konnte nicht verarbeitet werden.';
    res.status(400).json({
      error: 'invalid-backup-upload',
      message,
    });
  });
};

function resolveBackupFile(req: AuthRequest): Express.Multer.File | undefined {
  if (req.file) return req.file;
  const files = req.files as Record<string, Express.Multer.File[]> | Express.Multer.File[] | undefined;
  if (!files) return undefined;
  if (Array.isArray(files)) return files[0];
  return files.backup?.[0] || files.backupFile?.[0] || files.file?.[0];
}

function buildBackupFailureBody(
  failure: BackupOperationFailure,
  requestId?: string | null,
): Record<string, unknown> {
  return {
    error: failure.code,
    message: failure.message,
    ...(failure.details !== undefined ? { details: failure.details } : {}),
    ...(requestId !== undefined ? { requestId } : {}),
  };
}

router.get('/backup/export', authMiddleware, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const manifest = await buildBackupExportManifest();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="htmlsignage-backup-${stamp}.zip"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    const archiveDone = new Promise<void>((resolve, reject) => {
      archive.on('end', () => resolve());
      archive.on('error', (error) => reject(error));
    });

    archive.pipe(res);
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    for (const item of manifest.media) {
      archive.append(
        createReadStream(path.join(UPLOAD_DIR, item.filename)),
        { name: item.archivePath || `media/${item.filename}` },
      );
    }

    await archive.finalize();
    await archiveDone;
    await logAuditEvent(req, {
      action: 'system.backup.export',
      details: {
        mediaCount: manifest.media.length,
        formatVersion: manifest.formatVersion,
      },
    });
  } catch (error) {
    console.error('[system] Error exporting backup:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'backup-export-failed', message: 'Backup-Export fehlgeschlagen' });
    } else {
      res.end();
    }
  }
});

router.post('/backup/import/preview', authMiddleware, requireRole('admin'), backupUploadMiddleware, async (req: AuthRequest, res) => {
  const backupFile = resolveBackupFile(req);
  const filePath = backupFile?.path;
  const replaceMedia = parseReplaceMedia(req.body?.replaceMedia);

  if (!backupFile || !filePath) {
    return res.status(400).json({ error: 'backup-file-required', message: 'Backup-Datei erforderlich' });
  }

  try {
    const preview = await buildImportPreview(filePath, replaceMedia);
    await logAuditEvent(req, {
      action: 'system.backup.preview',
      details: {
        fileName: backupFile.originalname,
        replaceMedia,
        importedMedia: preview.importPlan.importedMedia,
      },
    });
    return res.json(preview);
  } catch (error) {
    const failure = getBackupOperationFailure(error, {
      code: 'backup-preview-failed',
      message: 'Backup-Vorschau fehlgeschlagen',
      status: 500,
    });

    if (failure.status >= 500) {
      console.error('[system] Error previewing backup import:', error);
    }

    return res.status(failure.status).json(buildBackupFailureBody(failure));
  } finally {
    await fs.unlink(filePath).catch(() => {});
  }
});

router.post('/backup/import', authMiddleware, requireRole('admin'), backupUploadMiddleware, async (req: AuthRequest, res) => {
  const backupFile = resolveBackupFile(req);
  const filePath = backupFile?.path;
  const replaceMedia = parseReplaceMedia(req.body?.replaceMedia);

  if (!backupFile || !filePath) {
    return res.status(400).json({
      error: 'backup-file-required',
      message: 'Backup-Datei erforderlich',
      requestId: req.requestId ?? null,
    });
  }

  const runningJob = await findRunningSystemJob('backup-import');
  if (runningJob) {
    return res.status(409).json({
      error: 'backup-import-in-progress',
      message: 'Ein Backup-Import läuft bereits',
      job: runningJob,
      requestId: req.requestId ?? null,
    });
  }

  const auditRequest = createAuditRequestSnapshot(req);
  const job = await createSystemJob({
    type: 'backup-import',
    title: `Backup importieren: ${backupFile.originalname}`,
    requestId: req.requestId ?? null,
    createdBy: req.user
      ? {
          id: req.user.id,
          username: req.user.username,
          email: req.user.email,
        }
      : null,
  });

  runSystemJob(job.id, async (context) => {
    try {
      const result = await importBackupArchive(filePath, replaceMedia, {
        setProgress: context.setProgress,
        appendLog: context.appendLog,
      });

      context.succeed(result);

      await logAuditEvent(auditRequest, {
        action: 'system.backup.import',
        details: {
          fileName: backupFile.originalname,
          replaceMedia,
          importedMedia: result.importedMedia,
          importedScheduleVersion: result.importedScheduleVersion,
          importedSettingsVersion: result.importedSettingsVersion,
          warnings: result.warnings,
          requestId: auditRequest.requestId ?? null,
          jobId: context.job.id,
        },
      });
    } catch (error) {
      const failure = getBackupOperationFailure(error, {
        code: 'backup-import-failed',
        message: error instanceof Error ? error.message : 'Backup-Import fehlgeschlagen',
        status: 500,
      });

      if (failure.status >= 500) {
        console.error('[system] Error importing backup:', error);
      }

      context.fail(
        failure.code,
        failure.message,
        failure.details === undefined ? null : { details: failure.details },
      );

      await logAuditEvent(auditRequest, {
        action: 'system.backup.import.failed',
        details: {
          fileName: backupFile.originalname,
          replaceMedia,
          errorCode: failure.code,
          requestId: auditRequest.requestId ?? null,
          jobId: context.job.id,
        },
      });
    } finally {
      await fs.unlink(filePath).catch(() => {});
    }
  });

  return res.status(202).json({
    ok: true,
    jobId: job.id,
    job,
    message: `Backup-Import für ${backupFile.originalname} wurde gestartet.`,
  });
});

export default router;
