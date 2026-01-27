<?php
declare(strict_types=1);

namespace HTMLSignage\API\V1;

/**
 * RESTful API Router
 *
 * Routes HTTP requests to appropriate controllers
 */
class Router
{
    private array $routes = [];
    private array $middleware = [];

    /**
     * Add route
     */
    public function addRoute(string $method, string $pattern, callable $handler): void
    {
        $this->routes[] = [
            'method' => strtoupper($method),
            'pattern' => $pattern,
            'handler' => $handler
        ];
    }

    /**
     * Shorthand methods
     */
    public function get(string $pattern, callable $handler): void
    {
        $this->addRoute('GET', $pattern, $handler);
    }

    public function post(string $pattern, callable $handler): void
    {
        $this->addRoute('POST', $pattern, $handler);
    }

    public function put(string $pattern, callable $handler): void
    {
        $this->addRoute('PUT', $pattern, $handler);
    }

    public function patch(string $pattern, callable $handler): void
    {
        $this->addRoute('PATCH', $pattern, $handler);
    }

    public function delete(string $pattern, callable $handler): void
    {
        $this->addRoute('DELETE', $pattern, $handler);
    }

    /**
     * Add middleware
     */
    public function use(callable $middleware): void
    {
        $this->middleware[] = $middleware;
    }

    /**
     * Handle incoming request
     */
    public function handle(): void
    {
        $method = $_SERVER['REQUEST_METHOD'];
        $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

        // Remove /admin/api/v1 prefix if present
        $path = preg_replace('#^/admin/api/v1#', '', $path);
        $path = rtrim($path, '/') ?: '/';

        // Run middleware
        foreach ($this->middleware as $middleware) {
            $result = $middleware($method, $path);
            if ($result === false) {
                return; // Middleware stopped the request
            }
        }

        // Find matching route
        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }

            $params = $this->matchRoute($route['pattern'], $path);
            if ($params !== null) {
                // Call handler with params
                call_user_func($route['handler'], $params);
                return;
            }
        }

        // No route found
        Response::notFound('Endpoint not found');
    }

    /**
     * Match route pattern against path
     *
     * Supports :param syntax
     * Example: /devices/:id matches /devices/123
     */
    private function matchRoute(string $pattern, string $path): ?array
    {
        // Convert :param to named regex groups
        $regex = preg_replace('#:([a-zA-Z_][a-zA-Z0-9_]*)#', '(?P<$1>[^/]+)', $pattern);
        $regex = '#^' . $regex . '$#';

        if (preg_match($regex, $path, $matches)) {
            // Extract only named parameters
            $params = array_filter(
                $matches,
                fn($key) => is_string($key),
                ARRAY_FILTER_USE_KEY
            );
            return $params;
        }

        return null;
    }

    /**
     * Get request body as JSON
     */
    public static function getJsonBody(): ?array
    {
        $input = file_get_contents('php://input');
        if (empty($input)) {
            return null;
        }

        $data = json_decode($input, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            Response::error('Invalid JSON in request body', 400);
        }

        return $data;
    }

    /**
     * Get query parameters
     */
    public static function getQueryParams(): array
    {
        return $_GET;
    }
}
