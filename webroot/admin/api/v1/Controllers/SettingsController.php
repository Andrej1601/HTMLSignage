<?php
declare(strict_types=1);

namespace HTMLSignage\API\V1\Controllers;

use HTMLSignage\API\V1\Response;
use HTMLSignage\API\V1\Router;

require_once __DIR__ . '/../../storage.php';

/**
 * Settings Controller
 * Handles slideshow settings and configuration
 */
class SettingsController extends BaseController
{
    /**
     * GET /api/v1/settings
     * Load settings
     */
    public function index(array $params): void
    {
        try {
            $settings = signage_settings_load();
            Response::success($settings);
        } catch (\Throwable $e) {
            error_log("Failed to load settings: " . $e->getMessage());
            Response::serverError('Failed to load settings');
        }
    }

    /**
     * PATCH /api/v1/settings
     * Update settings (partial update)
     */
    public function update(array $params): void
    {
        $body = Router::getJsonBody();

        if ($body === null) {
            Response::error('Request body is required', 400);
            return;
        }

        try {
            // Load current settings
            $currentSettings = signage_settings_load();

            // Merge with updates
            $updatedSettings = array_replace_recursive($currentSettings, $body);

            // Save
            $error = null;
            $status = null;

            $success = signage_settings_save($updatedSettings, $error, $status);

            if (!$success) {
                Response::error($error ?? 'Failed to save settings', 500);
                return;
            }

            $this->audit('settings.updated', null, [
                'updated_fields' => array_keys($body),
                'storage_status' => $status
            ]);

            Response::success([
                'settings' => $updatedSettings,
                'storage_status' => $status
            ], 'Settings updated successfully');

        } catch (\Throwable $e) {
            error_log("Failed to update settings: " . $e->getMessage());
            Response::serverError('Failed to update settings');
        }
    }

    /**
     * PUT /api/v1/settings
     * Replace entire settings
     */
    public function replace(array $params): void
    {
        $body = Router::getJsonBody();

        if ($body === null) {
            Response::error('Request body is required', 400);
            return;
        }

        try {
            $error = null;
            $status = null;

            $success = signage_settings_save($body, $error, $status);

            if (!$success) {
                Response::error($error ?? 'Failed to save settings', 500);
                return;
            }

            $this->audit('settings.replaced', null, [
                'storage_status' => $status
            ]);

            Response::success([
                'settings' => $body,
                'storage_status' => $status
            ], 'Settings replaced successfully');

        } catch (\Throwable $e) {
            error_log("Failed to replace settings: " . $e->getMessage());
            Response::serverError('Failed to replace settings');
        }
    }
}
