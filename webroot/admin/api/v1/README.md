# HTMLSignage API v1

Modern RESTful API für die Aufgussplan-Verwaltung.

## Architektur

```
admin/api/v1/
├── index.php                    # API Entry Point
├── Router.php                   # RESTful Router
├── Response.php                 # Type-safe Response Helper
├── Controllers/
│   ├── BaseController.php       # Basis für alle Controller
│   ├── ScheduleController.php   # Aufgussplan
│   ├── SettingsController.php   # Einstellungen
│   ├── DeviceController.php     # Geräte-Pairing
│   └── AssetController.php      # Bild/Video-Uploads
├── Middleware/
│   └── AuthMiddleware.php       # HTTP Basic Auth
└── Database/
    └── Connection.php           # PDO Connection Pool
```

## Features

✅ **RESTful** - Proper HTTP methods (GET, POST, PATCH, DELETE)
✅ **Type-Safe** - PHP 8.3+ mit `declare(strict_types=1)`
✅ **JSON Responses** - Konsistentes Format
✅ **Auth** - HTTP Basic Auth Middleware
✅ **CORS** - Automatisch konfiguriert
✅ **Error Handling** - Proper HTTP Status Codes
✅ **Audit Logging** - Alle Änderungen werden geloggt

---

## API Endpoints

### Health Check

```bash
GET /admin/api/v1/health
```

**Response:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "timestamp": 1769352458,
    "php_version": "8.3.6"
  }
}
```

---

### Schedule (Aufgussplan)

#### Get Schedule
```bash
GET /admin/api/v1/schedule
```

**Response:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "version": 1,
    "saunas": [...],
    "rows": [...],
    "meta": {...}
  }
}
```

#### Save Schedule
```bash
POST /admin/api/v1/schedule
Content-Type: application/json

{
  "version": 1,
  "saunas": [...],
  "rows": [...]
}
```

#### Export Schedule
```bash
GET /admin/api/v1/schedule/export
```
Returns JSON file download.

#### Import Schedule
```bash
POST /admin/api/v1/schedule/import
Content-Type: application/json

{
  "schedule": {
    "version": 1,
    "saunas": [...],
    "rows": [...]
  }
}
```

---

### Settings

#### Get Settings
```bash
GET /admin/api/v1/settings
```

#### Update Settings (Partial)
```bash
PATCH /admin/api/v1/settings
Content-Type: application/json

{
  "someField": "newValue"
}
```

#### Replace Settings (Complete)
```bash
PUT /admin/api/v1/settings
Content-Type: application/json

{
  "version": 1,
  ...entire settings object
}
```

---

### Devices

#### List Devices
```bash
GET /admin/api/v1/devices
```

**Response:**
```json
{
  "success": true,
  "data": {
    "now": 1769352458,
    "pairings": [...],
    "devices": [...]
  }
}
```

#### Get Device
```bash
GET /admin/api/v1/devices/:id
```

#### Create Pairing Code
```bash
POST /admin/api/v1/devices/pair
```

**Response:**
```json
{
  "success": true,
  "data": {
    "code": "ABC123",
    "expires_at": 1769352758
  }
}
```

#### Claim Device
```bash
POST /admin/api/v1/devices/:id/claim
Content-Type: application/json

{
  "name": "Lobby Display"
}
```

#### Update Device
```bash
PATCH /admin/api/v1/devices/:id
Content-Type: application/json

{
  "name": "New Name",
  "mode": "slideshow"
}
```

#### Unpair Device
```bash
DELETE /admin/api/v1/devices/:id
```

#### Get Pending Pairings
```bash
GET /admin/api/v1/devices/pending
```

---

### Assets

#### Upload Asset
```bash
POST /admin/api/v1/assets/upload
Content-Type: multipart/form-data

file=@image.jpg
```

**Response:**
```json
{
  "success": true,
  "data": {
    "filename": "upload_1769352458_abc123.jpg",
    "path": "/data/uploads/upload_1769352458_abc123.jpg",
    "size": 45678,
    "mime_type": "image/jpeg"
  }
}
```

#### Delete Asset
```bash
DELETE /admin/api/v1/assets/:filename
```

#### Cleanup Unused Assets
```bash
POST /admin/api/v1/assets/cleanup
```

---

## Response Format

All responses follow this format:

### Success Response
```json
{
  "success": true,
  "message": "OK",
  "data": {...}
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "errors": {
    "field": "Validation error"
  }
}
```

## HTTP Status Codes

- `200 OK` - Success
- `201 Created` - Resource created
- `204 No Content` - Success, no response body
- `400 Bad Request` - Invalid request
- `401 Unauthorized` - Auth required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `413 Payload Too Large` - File too large
- `415 Unsupported Media Type` - Invalid content type
- `422 Unprocessable Entity` - Validation failed
- `500 Internal Server Error` - Server error

---

## Authentication

Uses HTTP Basic Auth:

```bash
curl -u username:password http://localhost:8080/admin/api/v1/schedule
```

Or with Authorization header:

```bash
curl -H "Authorization: Basic <base64>" http://localhost:8080/admin/api/v1/schedule
```

**Roles:**
- `viewer` - Read-only access (GET)
- `editor` - Can edit (GET, POST, PATCH, DELETE)
- `admin` - Full access

---

## Migration Path to Node.js/TypeScript

Diese API ist so strukturiert, dass der spätere Umstieg auf Node.js/TypeScript einfach ist:

1. **RESTful Routes** - Identische Endpoints
2. **JSON Responses** - Gleiche Response-Struktur
3. **Controller-Pattern** - 1:1 übertragbar auf Express/Fastify
4. **Middleware** - Gleiche Middleware-Konzepte
5. **Type Safety** - PHP strict_types → TypeScript

### Vorgeschlagener Node.js Stack:
- **Runtime**: Node.js 20+ LTS
- **Framework**: Fastify (schneller als Express)
- **Database**: Better-SQLite3 oder Prisma + PostgreSQL
- **Validation**: Zod
- **Real-time**: Socket.IO oder SSE
- **Type Safety**: TypeScript strict mode

---

## Nächste Schritte

### Kurzfristig (PHP):
1. ✅ RESTful API v1 mit Router
2. ✅ Type-safe Controllers
3. ✅ Auth Middleware
4. ⏳ Relationale DB-Struktur (statt JSON blobs)
5. ⏳ Request/Response Validation
6. ⏳ WebSocket für Device-Updates

### Langfristig (Node.js):
1. ⏳ TypeScript API mit Fastify
2. ⏳ Prisma ORM mit relationalen Models
3. ⏳ Zod Validation
4. ⏳ Socket.IO für Echtzeit
5. ⏳ API Tests mit Vitest
