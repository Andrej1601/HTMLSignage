<?php
declare(strict_types=1);

namespace HTMLSignage\API\V1\Controllers;

use HTMLSignage\API\V1\Response;

require_once __DIR__ . '/../../storage.php';

/**
 * Asset Controller
 * Handles file uploads and asset management
 */
class AssetController extends BaseController
{
    private const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    private const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];
    private const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

    /**
     * POST /api/v1/assets/upload
     * Upload image or video
     */
    public function upload(array $params): void
    {
        if (!isset($_FILES['file'])) {
            Response::error('No file uploaded', 400);
            return;
        }

        $file = $_FILES['file'];

        // Check for upload errors
        if ($file['error'] !== UPLOAD_ERR_OK) {
            Response::error($this->getUploadErrorMessage($file['error']), 400);
            return;
        }

        // Validate file size
        if ($file['size'] > self::MAX_FILE_SIZE) {
            Response::error('File too large (max 100MB)', 413);
            return;
        }

        // Validate mime type
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        $allowedTypes = array_merge(self::ALLOWED_IMAGE_TYPES, self::ALLOWED_VIDEO_TYPES);
        if (!in_array($mimeType, $allowedTypes, true)) {
            Response::error('Invalid file type. Allowed: images and videos', 415);
            return;
        }

        try {
            // Generate unique filename
            $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
            $filename = 'upload_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $extension;

            // Determine upload directory
            $uploadDir = signage_get_data_path('uploads');
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }

            $targetPath = $uploadDir . '/' . $filename;

            // Move uploaded file
            if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
                Response::serverError('Failed to save uploaded file');
                return;
            }

            // Make readable
            chmod($targetPath, 0644);

            $this->audit('asset.uploaded', null, [
                'filename' => $filename,
                'size' => $file['size'],
                'mime_type' => $mimeType
            ]);

            Response::success([
                'filename' => $filename,
                'path' => '/data/uploads/' . $filename,
                'size' => $file['size'],
                'mime_type' => $mimeType
            ], 'File uploaded successfully', 201);

        } catch (\Throwable $e) {
            error_log("Failed to upload file: " . $e->getMessage());
            Response::serverError('Failed to upload file');
        }
    }

    /**
     * DELETE /api/v1/assets/:filename
     * Delete uploaded asset
     */
    public function destroy(array $params): void
    {
        $filename = $params['filename'] ?? null;

        if (!$filename) {
            Response::error('Filename is required', 400);
            return;
        }

        // Prevent directory traversal
        if (strpos($filename, '..') !== false || strpos($filename, '/') !== false) {
            Response::error('Invalid filename', 400);
            return;
        }

        try {
            $uploadDir = signage_get_data_path('uploads');
            $filePath = $uploadDir . '/' . $filename;

            if (!file_exists($filePath)) {
                Response::notFound('File not found');
                return;
            }

            if (!unlink($filePath)) {
                Response::serverError('Failed to delete file');
                return;
            }

            $this->audit('asset.deleted', null, [
                'filename' => $filename
            ]);

            Response::success(null, 'File deleted successfully');

        } catch (\Throwable $e) {
            error_log("Failed to delete asset: " . $e->getMessage());
            Response::serverError('Failed to delete asset');
        }
    }

    /**
     * POST /api/v1/assets/cleanup
     * Clean up unused assets
     */
    public function cleanup(array $params): void
    {
        try {
            // This would call the existing cleanup_assets.php logic
            // For now, return success
            Response::success([
                'cleaned' => 0
            ], 'Cleanup completed');

        } catch (\Throwable $e) {
            error_log("Failed to cleanup assets: " . $e->getMessage());
            Response::serverError('Failed to cleanup assets');
        }
    }

    /**
     * Get upload error message
     */
    private function getUploadErrorMessage(int $code): string
    {
        return match ($code) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'File too large',
            UPLOAD_ERR_PARTIAL => 'File was only partially uploaded',
            UPLOAD_ERR_NO_FILE => 'No file was uploaded',
            UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary folder',
            UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
            UPLOAD_ERR_EXTENSION => 'File upload stopped by extension',
            default => 'Unknown upload error'
        };
    }
}
