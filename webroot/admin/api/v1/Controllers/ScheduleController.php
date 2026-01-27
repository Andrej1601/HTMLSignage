<?php
declare(strict_types=1);

namespace HTMLSignage\API\V1\Controllers;

use HTMLSignage\API\V1\Response;
use HTMLSignage\API\V1\Router;

require_once __DIR__ . '/../../storage.php';

/**
 * Schedule Controller
 * Handles Aufgussplan (schedule) operations
 */
class ScheduleController extends BaseController
{
    /**
     * GET /api/v1/schedule
     * Load complete schedule
     */
    public function index(array $params): void
    {
        try {
            $schedule = signage_schedule_load();
            Response::success($schedule);
        } catch (\Throwable $e) {
            error_log("Failed to load schedule: " . $e->getMessage());
            Response::serverError('Failed to load schedule');
        }
    }

    /**
     * POST /api/v1/schedule
     * Save schedule
     */
    public function save(array $params): void
    {
        $body = Router::getJsonBody();

        if ($body === null) {
            Response::error('Request body is required', 400);
            return;
        }

        // Validate required fields
        if (!isset($body['version'])) {
            Response::validationError(['version' => 'Version is required']);
            return;
        }

        try {
            $error = null;
            $status = null;

            $success = signage_schedule_save($body, $error, $status);

            if (!$success) {
                Response::error($error ?? 'Failed to save schedule', 500);
                return;
            }

            $this->audit('schedule.saved', null, [
                'saunas_count' => count($body['saunas'] ?? []),
                'rows_count' => count($body['rows'] ?? []),
                'storage_status' => $status
            ]);

            Response::success([
                'saved' => true,
                'storage_status' => $status
            ], 'Schedule saved successfully');

        } catch (\Throwable $e) {
            error_log("Failed to save schedule: " . $e->getMessage());
            Response::serverError('Failed to save schedule');
        }
    }

    /**
     * GET /api/v1/schedule/export
     * Export schedule as JSON file
     */
    public function export(array $params): void
    {
        try {
            $schedule = signage_schedule_load();

            header('Content-Type: application/json; charset=UTF-8');
            header('Content-Disposition: attachment; filename="aufgussplan-' . date('Y-m-d') . '.json"');

            echo json_encode($schedule, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            exit;

        } catch (\Throwable $e) {
            error_log("Failed to export schedule: " . $e->getMessage());
            Response::serverError('Failed to export schedule');
        }
    }

    /**
     * POST /api/v1/schedule/import
     * Import schedule from JSON file
     */
    public function import(array $params): void
    {
        $body = Router::getJsonBody();

        if ($body === null || !isset($body['schedule'])) {
            Response::error('Invalid import data', 400);
            return;
        }

        try {
            $error = null;
            $status = null;

            $success = signage_schedule_save($body['schedule'], $error, $status);

            if (!$success) {
                Response::error($error ?? 'Failed to import schedule', 500);
                return;
            }

            $this->audit('schedule.imported', null, [
                'saunas_count' => count($body['schedule']['saunas'] ?? []),
                'rows_count' => count($body['schedule']['rows'] ?? [])
            ]);

            Response::success([
                'imported' => true,
                'storage_status' => $status
            ], 'Schedule imported successfully');

        } catch (\Throwable $e) {
            error_log("Failed to import schedule: " . $e->getMessage());
            Response::serverError('Failed to import schedule');
        }
    }
}
