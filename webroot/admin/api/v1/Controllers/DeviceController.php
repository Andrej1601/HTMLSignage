<?php
declare(strict_types=1);

namespace HTMLSignage\API\V1\Controllers;

use HTMLSignage\API\V1\Response;
use HTMLSignage\API\V1\Router;

require_once __DIR__ . '/../../devices_store.php';

/**
 * Device Controller
 * Handles device pairing and management
 */
class DeviceController extends BaseController
{
    /**
     * GET /api/v1/devices
     * List all devices and pairings
     */
    public function index(array $params): void
    {
        try {
            $state = devices_load();
            $now = time();
            $payload = devices_build_list_payload($state, $now);

            Response::success([
                'now' => $now,
                'pairings' => $payload['pairings'],
                'devices' => $payload['devices']
            ]);
        } catch (\Throwable $e) {
            error_log("Failed to load devices: " . $e->getMessage());
            Response::serverError('Failed to load devices');
        }
    }

    /**
     * GET /api/v1/devices/:id
     * Get device details
     */
    public function show(array $params): void
    {
        $id = $params['id'] ?? null;

        if (!$id) {
            Response::error('Device ID is required', 400);
            return;
        }

        try {
            $state = devices_load();

            if (!isset($state['devices'][$id])) {
                Response::notFound('Device not found');
                return;
            }

            $device = $state['devices'][$id];

            Response::success([
                'device' => $device
            ]);
        } catch (\Throwable $e) {
            error_log("Failed to load device: " . $e->getMessage());
            Response::serverError('Failed to load device');
        }
    }

    /**
     * POST /api/v1/devices/pair
     * Create pairing code
     */
    public function createPairing(array $params): void
    {
        $body = Router::getJsonBody() ?? [];

        try {
            $result = devices_begin_pairing();

            if (!$result['ok']) {
                Response::error($result['error'] ?? 'Failed to create pairing', 500);
                return;
            }

            $this->audit('device.pairing_created', null, [
                'code' => $result['code']
            ]);

            Response::success([
                'code' => $result['code'],
                'expires_at' => $result['expires']
            ], 'Pairing code created');

        } catch (\Throwable $e) {
            error_log("Failed to create pairing: " . $e->getMessage());
            Response::serverError('Failed to create pairing');
        }
    }

    /**
     * POST /api/v1/devices/:id/claim
     * Claim paired device
     */
    public function claim(array $params): void
    {
        $id = $params['id'] ?? null;
        $body = Router::getJsonBody() ?? [];

        if (!$id) {
            Response::error('Device ID is required', 400);
            return;
        }

        $name = $body['name'] ?? null;
        if (!$name) {
            Response::validationError(['name' => 'Device name is required']);
            return;
        }

        try {
            $result = devices_claim($id, $this->sanitize($name));

            if (!$result['ok']) {
                Response::error($result['error'] ?? 'Failed to claim device', 400);
                return;
            }

            $this->audit('device.claimed', null, [
                'device_id' => $id,
                'name' => $name
            ]);

            Response::success([
                'device' => $result['device']
            ], 'Device claimed successfully');

        } catch (\Throwable $e) {
            error_log("Failed to claim device: " . $e->getMessage());
            Response::serverError('Failed to claim device');
        }
    }

    /**
     * PATCH /api/v1/devices/:id
     * Update device (rename, change mode, etc.)
     */
    public function update(array $params): void
    {
        $id = $params['id'] ?? null;
        $body = Router::getJsonBody() ?? [];

        if (!$id) {
            Response::error('Device ID is required', 400);
            return;
        }

        try {
            // Rename if name is provided
            if (isset($body['name'])) {
                $result = devices_rename($id, $this->sanitize($body['name']));
                if (!$result['ok']) {
                    Response::error($result['error'] ?? 'Failed to rename device', 400);
                    return;
                }

                $this->audit('device.renamed', null, [
                    'device_id' => $id,
                    'new_name' => $body['name']
                ]);
            }

            // Update mode if provided
            if (isset($body['mode'])) {
                $result = devices_set_mode($id, $this->sanitize($body['mode']));
                if (!$result['ok']) {
                    Response::error($result['error'] ?? 'Failed to update mode', 400);
                    return;
                }

                $this->audit('device.mode_changed', null, [
                    'device_id' => $id,
                    'mode' => $body['mode']
                ]);
            }

            // Get updated device
            $state = devices_load();
            $device = $state['devices'][$id] ?? null;

            Response::success([
                'device' => $device
            ], 'Device updated successfully');

        } catch (\Throwable $e) {
            error_log("Failed to update device: " . $e->getMessage());
            Response::serverError('Failed to update device');
        }
    }

    /**
     * DELETE /api/v1/devices/:id
     * Unpair device
     */
    public function destroy(array $params): void
    {
        $id = $params['id'] ?? null;

        if (!$id) {
            Response::error('Device ID is required', 400);
            return;
        }

        try {
            $result = devices_unpair($id);

            if (!$result['ok']) {
                Response::error($result['error'] ?? 'Failed to unpair device', 400);
                return;
            }

            $this->audit('device.unpaired', null, [
                'device_id' => $id
            ]);

            Response::success(null, 'Device unpaired successfully');

        } catch (\Throwable $e) {
            error_log("Failed to unpair device: " . $e->getMessage());
            Response::serverError('Failed to unpair device');
        }
    }

    /**
     * GET /api/v1/devices/pending
     * Get pending pairing codes
     */
    public function pending(array $params): void
    {
        try {
            $result = devices_pending_pairings();

            Response::success([
                'pairings' => $result['pairings'] ?? []
            ]);
        } catch (\Throwable $e) {
            error_log("Failed to load pending pairings: " . $e->getMessage());
            Response::serverError('Failed to load pending pairings');
        }
    }
}
