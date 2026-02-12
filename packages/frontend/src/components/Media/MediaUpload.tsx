import { useCallback, useState } from 'react';
import { Upload, X, AlertCircle, CheckCircle } from 'lucide-react';
import { useUploadMedia } from '@/hooks/useMedia';
import { MAX_FILE_SIZE, ACCEPTED_IMAGE_TYPES, ACCEPTED_AUDIO_TYPES, ACCEPTED_VIDEO_TYPES } from '@/types/media.types';

interface MediaUploadProps {
  onUploadComplete?: () => void;
}

export function MediaUpload({ onUploadComplete }: MediaUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);

  const uploadMutation = useUploadMedia();

  const acceptedTypes = [
    ...ACCEPTED_IMAGE_TYPES,
    ...ACCEPTED_AUDIO_TYPES,
    ...ACCEPTED_VIDEO_TYPES
  ];

  const validateFile = (file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return `Dateityp nicht unterstützt: ${file.type}`;
    }

    if (file.size > MAX_FILE_SIZE) {
      const maxSizeMB = MAX_FILE_SIZE / 1024 / 1024;
      return `Datei zu groß. Maximum: ${maxSizeMB}MB`;
    }

    return null;
  };

  const handleFile = (file: File) => {
    setError('');
    setSuccess(false);

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSelectedFile(file);
  };

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

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      await uploadMutation.mutateAsync(selectedFile);
      setSuccess(true);
      setSelectedFile(null);
      setError('');

      setTimeout(() => {
        setSuccess(false);
        onUploadComplete?.();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Upload fehlgeschlagen');
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setError('');
    setSuccess(false);
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
              Datei hochladen
            </p>
            <p className="text-sm text-spa-text-secondary mb-4">
              Ziehe eine Datei hierher oder klicke zum Auswählen
            </p>

            <label className="inline-block px-6 py-2 bg-spa-primary text-white rounded-lg hover:bg-spa-primary-dark transition-colors cursor-pointer">
              Datei auswählen
              <input
                type="file"
                className="hidden"
                accept={acceptedTypes.join(',')}
                onChange={handleFileInput}
                disabled={uploadMutation.isPending}
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

      {/* Selected File */}
      {selectedFile && !success && (
        <div className="bg-white rounded-lg shadow-sm border border-spa-bg-secondary p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-2 bg-spa-bg-primary rounded-lg">
                <Upload className="w-5 h-5 text-spa-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-spa-text-primary truncate">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-spa-text-secondary">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <button
              onClick={handleCancel}
              disabled={uploadMutation.isPending}
              className="p-2 hover:bg-spa-bg-primary rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-spa-text-secondary" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              disabled={uploadMutation.isPending}
              className="flex-1 px-4 py-2 bg-spa-bg-secondary text-spa-text-primary rounded-lg hover:bg-spa-secondary/20 transition-colors disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              onClick={handleUpload}
              disabled={uploadMutation.isPending}
              className="flex-1 px-4 py-2 bg-spa-primary text-white rounded-lg hover:bg-spa-primary-dark transition-colors disabled:opacity-50"
            >
              {uploadMutation.isPending ? 'Wird hochgeladen...' : 'Hochladen'}
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
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-green-900">Erfolg!</p>
            <p className="text-sm text-green-700 mt-1">Datei wurde erfolgreich hochgeladen</p>
          </div>
        </div>
      )}
    </div>
  );
}
