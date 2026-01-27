<?php
// Session-based Authentication Manager
// Modern session handling with secure cookies, CSRF protection, and remember-me

declare(strict_types=1);

require_once __DIR__ . '/../storage.php';
require_once __DIR__ . '/users_store.php';

const SESSION_NAME = 'HTMLSIGNAGE_SESSION';
const SESSION_LIFETIME = 28800; // 8 hours
const REMEMBER_LIFETIME = 2592000; // 30 days
const CSRF_TOKEN_LENGTH = 32;

/**
 * Initialize secure session
 */
function session_init(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $cookieParams = [
        'lifetime' => 0,
        'path' => '/admin/',
        'domain' => '',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax',
    ];

    session_name(SESSION_NAME);
    session_set_cookie_params($cookieParams);
    session_start();

    // Regenerate session ID periodically to prevent fixation
    if (!isset($_SESSION['regenerated'])) {
        session_regenerate_id(true);
        $_SESSION['regenerated'] = time();
    } elseif (time() - $_SESSION['regenerated'] > 1800) { // Every 30 minutes
        session_regenerate_id(true);
        $_SESSION['regenerated'] = time();
    }
}

/**
 * Check if user is authenticated
 */
function session_is_authenticated(): bool
{
    session_init();

    if (empty($_SESSION['user_authenticated']) || empty($_SESSION['username'])) {
        return false;
    }

    // Check session timeout
    if (isset($_SESSION['last_activity'])) {
        $inactive = time() - $_SESSION['last_activity'];
        if ($inactive > SESSION_LIFETIME) {
            session_destroy_user();
            return false;
        }
    }

    $_SESSION['last_activity'] = time();
    return true;
}

/**
 * Get current authenticated user
 */
function session_get_user(): ?array
{
    if (!session_is_authenticated()) {
        return null;
    }

    try {
        $username = $_SESSION['username'] ?? null;
        if ($username === null) {
            return null;
        }

        return auth_users_find($username);
    } catch (Throwable $e) {
        error_log('Failed to load session user: ' . $e->getMessage());
        return null;
    }
}

/**
 * Authenticate user and create session
 */
function session_authenticate(string $username, string $password, bool $remember = false): bool
{
    session_init();

    try {
        $user = auth_users_find($username);
        if ($user === null) {
            auth_append_audit('login.failed', ['user' => $username, 'reason' => 'user_not_found']);
            return false;
        }

        if (!auth_verify_password($password, (string) $user['password'])) {
            auth_append_audit('login.failed', ['user' => $username, 'reason' => 'invalid_password']);
            return false;
        }

        // Create session
        session_regenerate_id(true);
        $_SESSION['user_authenticated'] = true;
        $_SESSION['username'] = $username;
        $_SESSION['login_time'] = time();
        $_SESSION['last_activity'] = time();
        $_SESSION['regenerated'] = time();
        $_SESSION['user_agent'] = $_SERVER['HTTP_USER_AGENT'] ?? '';
        $_SESSION['ip_address'] = $_SERVER['REMOTE_ADDR'] ?? '';

        // Remember me token
        if ($remember) {
            session_create_remember_token($username);
        }

        auth_append_audit('login.success', [
            'user' => $username,
            'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
        ]);

        return true;
    } catch (Throwable $e) {
        error_log('Session authentication error: ' . $e->getMessage());
        return false;
    }
}

/**
 * Create remember-me token
 */
function session_create_remember_token(string $username): void
{
    $token = bin2hex(random_bytes(32));
    $hash = password_hash($token, PASSWORD_DEFAULT);

    // Store in database
    try {
        $pdo = signage_db();
        $stmt = $pdo->prepare('INSERT OR REPLACE INTO remember_tokens (username, token_hash, created_at, expires_at) VALUES (:username, :hash, :created, :expires)');
        $stmt->execute([
            ':username' => $username,
            ':hash' => $hash,
            ':created' => time(),
            ':expires' => time() + REMEMBER_LIFETIME,
        ]);
    } catch (Throwable $e) {
        error_log('Failed to create remember token: ' . $e->getMessage());
        return;
    }

    // Set cookie
    setcookie(
        'remember_token',
        $token,
        [
            'expires' => time() + REMEMBER_LIFETIME,
            'path' => '/admin/',
            'domain' => '',
            'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
            'httponly' => true,
            'samesite' => 'Lax',
        ]
    );
}

/**
 * Check and restore session from remember token
 */
function session_check_remember_token(): bool
{
    if (session_is_authenticated()) {
        return true;
    }

    $token = $_COOKIE['remember_token'] ?? null;
    if ($token === null || !is_string($token)) {
        return false;
    }

    try {
        $pdo = signage_db();
        $stmt = $pdo->prepare('SELECT username, token_hash, expires_at FROM remember_tokens WHERE expires_at > :now');
        $stmt->execute([':now' => time()]);

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            if (password_verify($token, (string) $row['token_hash'])) {
                // Valid token - restore session
                session_init();
                session_regenerate_id(true);
                $_SESSION['user_authenticated'] = true;
                $_SESSION['username'] = $row['username'];
                $_SESSION['login_time'] = time();
                $_SESSION['last_activity'] = time();
                $_SESSION['regenerated'] = time();
                $_SESSION['remembered'] = true;

                return true;
            }
        }
    } catch (Throwable $e) {
        error_log('Failed to check remember token: ' . $e->getMessage());
    }

    return false;
}

/**
 * Destroy user session
 */
function session_destroy_user(): void
{
    session_init();

    // Clear remember token
    if (isset($_COOKIE['remember_token'])) {
        setcookie('remember_token', '', [
            'expires' => time() - 3600,
            'path' => '/admin/',
        ]);

        try {
            $username = $_SESSION['username'] ?? null;
            if ($username !== null) {
                $pdo = signage_db();
                $stmt = $pdo->prepare('DELETE FROM remember_tokens WHERE username = :username');
                $stmt->execute([':username' => $username]);
            }
        } catch (Throwable $e) {
            error_log('Failed to delete remember token: ' . $e->getMessage());
        }
    }

    $username = $_SESSION['username'] ?? 'unknown';

    // Clear session
    $_SESSION = [];
    session_destroy();

    auth_append_audit('logout', ['user' => $username]);
}

/**
 * Generate CSRF token
 */
function session_csrf_token(): string
{
    session_init();

    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(CSRF_TOKEN_LENGTH));
    }

    return $_SESSION['csrf_token'];
}

/**
 * Verify CSRF token
 */
function session_csrf_verify(string $token): bool
{
    session_init();

    if (empty($_SESSION['csrf_token'])) {
        return false;
    }

    return hash_equals($_SESSION['csrf_token'], $token);
}

/**
 * Require authentication (redirect if not authenticated)
 */
function session_require_auth(): void
{
    if (!session_check_remember_token() && !session_is_authenticated()) {
        // Return JSON for API calls
        if (str_contains($_SERVER['REQUEST_URI'] ?? '', '/api/')) {
            http_response_code(401);
            header('Content-Type: application/json');
            echo json_encode([
                'success' => false,
                'error' => 'unauthorized',
                'message' => 'Authentication required',
            ]);
            exit;
        }

        // Redirect to login for page requests
        $loginUrl = '/admin/login.php';
        $returnUrl = $_SERVER['REQUEST_URI'] ?? '/admin/';
        header('Location: ' . $loginUrl . '?return=' . urlencode($returnUrl));
        exit;
    }
}

/**
 * Clean up expired remember tokens (call periodically)
 */
function session_cleanup_remember_tokens(): void
{
    try {
        $pdo = signage_db();
        $stmt = $pdo->prepare('DELETE FROM remember_tokens WHERE expires_at < :now');
        $stmt->execute([':now' => time()]);
    } catch (Throwable $e) {
        error_log('Failed to cleanup remember tokens: ' . $e->getMessage());
    }
}
