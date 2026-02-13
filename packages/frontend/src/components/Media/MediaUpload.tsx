import { useCallback, useMemo, useState } from 'react';
import { Upload, X, AlertCircle, CheckCircle } from 'lucide-react';
import { useUploadMedia } from '@/hooks/useMedia';
import {
  MAX_FILE_SIZE,
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_AUDIO_TYPES,
  ACCEPTED_VIDEO_TYPES,
  formatFileSize,
} from '@/types/media.types';

interface MediaUploadProps {
  onUploadComplete?: () => void;
}

const getFileKey = (file: File): string => `${file.name}-${file.size}-${file.lastModified}`;

export function MediaUpload({ onUploadComplete }: MediaUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState<{ uploaded: number; total: number } | null>(null);

  const uploadMutation = useUploadMedia();
  const isUploading = uploadProgress !== null;

  const acceptedTypes = useMemo(() => ([
    ...ACCEPTED_IMAGE_TYPES,
    ...ACCEPTED_AUDIO_TYPES,
    ...ACCEPTED_VIDEO_TYPES
  ]), []);

  const totalSelectedSize = useMemo(
    () => selectedFiles.reduce((sum, file) => sum + file.size, 0),
    [selectedFiles]
  );

  const validateFile = useCallback((file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return `Dateityp nicht unterstützt: ${file.type}`;
    }

    if (file.size > MAX_FILE_SIZE) {
      const maxSizeMB = MAX_FILE_SIZE / 1024 / 1024;
      return `Datei zu groß. Maximum: ${maxSizeMB}MB`;
    }

    return null;
  }, [acceptedTypes]);

  const handleFiles = useCallback((files: File[]) => {
    setError('');
    setSuccessMessage('');

    const validFiles: File[] = [];
    const validationErrors: string[] = [];

    files.forEach((file) => {
      const validationError = validateFile(file);
      if (validationError) {
        validationErrors.push(`${file.name}: ${validationError}`);
        return;
      }
      validFiles.push(file);
    });

    if (validFiles.length > 0) {
      setSelectedFiles((prev) => {
        const existingKeys = new Set(prev.map(getFileKey));
        const uniqueNewFiles = validFiles.filter((file) => !existingKeys.has(getFileKey(file)));
        return [...prev, ...uniqueNewFiles];
      });
    }

    if (validationErrors.length > 0) {
      setError(validationErrors.join('\n'));
    }
  }, [validateFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    handleFiles(Array.from(e.dataTransfer.files));
  }, [handleFiles]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(Array.from(files));
    }

    e.target.value = '';
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || isUploading) return;

    setError('');
    setSuccessMessage('');

    const filesToUpload = [...selectedFiles];
    const failedUploads: Array<{ file: File; message: string }> = [];
    let uploadedCount = 0;

    setUploadProgress({ uploaded: 0, total: filesToUpload.length });

    for (const file of filesToUpload) {
      try {
        await uploadMutation.mutateAsync(file);
        uploadedCount += 1;
      } catch (err: any) {
        failedUploads.push({
          file,
          message: err?.message || 'Upload fehlgeschlagen',
        });
      } finally {
        setUploadProgress({ uploaded: uploadedCount, total: filesToUpload.length });
      }
    }

    setUploadProgress(null);

    if (uploadedCount > 0) {
      onUploadComplete?.();
    }

    if (failedUploads.length === 0) {
      setSelectedFiles([]);
      setSuccessMessage(
        `${uploadedCount} Datei${uploadedCount === 1 ? '' : 'en'} wurde${uploadedCount === 1 ? '' : 'n'} erfolgreich hochgeladen.`
      );

      setTimeout(() => {
        setSuccessMessage('');
      }, 2500);
      return;
    }

    setSelectedFiles(failedUploads.map((item) => item.file));
    const failedDetails = failedUploads
      .slice(0, 5)
      .map((item) => `${item.file.name}: ${item.message}`)
      .join('\n');

    const moreFailures = failedUploads.length > 5 ? '\n...' : '';
    setError(
      `${uploadedCount} von ${filesToUpload.length} Dateien hochgeladen. ${failedUploads.length} fehlgeschlagen.\n${failedDetails}${moreFailures}`
    );

    if (uploadedCount > 0) {
      setSuccessMessage(`${uploadedCount} Datei${uploadedCount === 1 ? '' : 'en'} erfolgreich hochgeladen.`);
    }
  };

  const handleCancel = () => {
    setSelectedFiles([]);
    setError('');
    setSuccessMessage('');
    setUploadProgress(null);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-spa-primary bg-spa-primary/5'
            : 'border-spa-bg-secondary hover:border-spa-primary/50'
        }`}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 bg-spa-bg-primary rounded-full">
            <Upload className="w-8 h-8 text-spa-primary" />
          </div>

          <div>
            <p className="text-lg font-medium text-spa-text-primary mb-2">
              Datei(en) hochladen
            </p>
            <p className="text-sm text-spa-text-secondary mb-4">
              Ziehe eine oder mehrere Dateien hierher oder klicke zum Auswählen
            </p>

            <label className="inline-block px-6 py-2 bg-spa-primary text-white rounded-lg hover:bg-spa-primary-dark transition-colors cursor-pointer">
              Dateien auswählen
              <input
                type="file"
                className="hidden"
                accept={acceptedTypes.join(',')}
                multiple
                onChange={handleFileInput}
                disabled={isUploading}
              />
            </label>
          </div>

          <p className="text-xs text-spa-text-secondary">
            Unterstützt: Bilder (JPG, PNG, GIF, WebP, SVG), Audio (MP3, WAV, OGG), Video (MP4, WebM)
            <br />
            Max. Dateigröße: 50MB
          </p>
        </div>
      </div>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-spa-bg-secondary p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-spa-text-primary">
                {selectedFiles.length} Datei{selectedFiles.length === 1 ? '' : 'en'} ausgewählt
              </p>
              <p className="text-sm text-spa-text-secondary">
                Gesamtgröße: {formatFileSize(totalSelectedSize)}
              </p>
            </div>
            <button
              onClick={handleCancel}
              disabled={isUploading}
              className="p-2 hover:bg-spa-bg-primary rounded-lg transition-colors disabled:opacity-50"
              aria-label="Auswahl löschen"
            >
              <X className="w-5 h-5 text-spa-text-secondary" />
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-2 mb-4 pr-1">
            {selectedFiles.map((file, index) => (
              <div
                key={getFileKey(file)}
                className="flex items-center justify-between gap-3 rounded-lg border border-spa-bg-secondary px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-spa-text-primary truncate">{file.name}</p>
                  <p className="text-xs text-spa-text-secondary">{formatFileSize(file.size)}</p>
                </div>
                <button
                  onClick={() => handleRemoveFile(index)}
                  disabled={isUploading}
                  className="p-1.5 hover:bg-spa-bg-primary rounded-md transition-colors disabled:opacity-50"
                  aria-label={`${file.name} entfernen`}
                >
                  <X className="w-4 h-4 text-spa-text-secondary" />
                </button>
              </div>
            ))}
          </div>

          {uploadProgress && (
            <p className="text-sm text-spa-text-secondary mb-3">
              Upload läuft: {uploadProgress.uploaded}/{uploadProgress.total}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              disabled={isUploading}
              className="flex-1 px-4 py-2 bg-spa-bg-secondary text-spa-text-primary rounded-lg hover:bg-spa-secondary/20 transition-colors disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="flex-1 px-4 py-2 bg-spa-primary text-white rounded-lg hover:bg-spa-primary-dark transition-colors disabled:opacity-50"
            >
              {isUploading
                ? `Wird hochgeladen (${uploadProgress?.uploaded ?? 0}/${uploadProgress?.total ?? selectedFiles.length})...`
                : `${selectedFiles.length} Datei${selectedFiles.length === 1 ? '' : 'en'} hochladen`}
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-red-900">Fehler</p>
            <p className="text-sm text-red-700 mt-1 whitespace-pre-line">{error}</p>
          </div>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-green-900">Erfolg!</p>
            <p className="text-sm text-green-700 mt-1">{successMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}
