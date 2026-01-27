<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - HTMLSignage Admin</title>
    <style>
        :root {
            --spa-primary: #8B6F47;
            --spa-primary-light: #B8976A;
            --spa-primary-dark: #6B5435;
            --spa-secondary: #7FA99B;
            --spa-accent: #D4A574;
            --spa-bg-primary: #F9F7F4;
            --spa-bg-secondary: #EDE9E3;
            --spa-text-primary: #2C2416;
            --spa-text-secondary: #5A4E3F;
            --spa-error: #C17A6B;
            --spa-success: #6B9B7A;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, var(--spa-bg-secondary) 0%, var(--spa-bg-primary) 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--spa-text-primary);
        }

        .login-container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(44, 36, 22, 0.12);
            padding: 3rem 2.5rem;
            width: 100%;
            max-width: 420px;
            margin: 1rem;
        }

        .login-header {
            text-align: center;
            margin-bottom: 2rem;
        }

        .login-header h1 {
            color: var(--spa-primary);
            font-size: 1.75rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
        }

        .login-header p {
            color: var(--spa-text-secondary);
            font-size: 0.925rem;
        }

        .form-group {
            margin-bottom: 1.5rem;
        }

        .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            color: var(--spa-text-primary);
            font-weight: 500;
            font-size: 0.925rem;
        }

        .form-group input {
            width: 100%;
            padding: 0.75rem 1rem;
            border: 2px solid var(--spa-bg-secondary);
            border-radius: 8px;
            font-size: 1rem;
            font-family: inherit;
            color: var(--spa-text-primary);
            background: var(--spa-bg-primary);
            transition: border-color 0.2s, box-shadow 0.2s;
        }

        .form-group input:focus {
            outline: none;
            border-color: var(--spa-primary);
            box-shadow: 0 0 0 3px rgba(139, 111, 71, 0.1);
        }

        .form-group input::placeholder {
            color: var(--spa-text-secondary);
            opacity: 0.6;
        }

        .checkbox-group {
            display: flex;
            align-items: center;
            margin-bottom: 1.5rem;
        }

        .checkbox-group input[type="checkbox"] {
            width: auto;
            margin-right: 0.5rem;
            cursor: pointer;
        }

        .checkbox-group label {
            margin: 0;
            cursor: pointer;
            font-weight: normal;
            font-size: 0.925rem;
            color: var(--spa-text-secondary);
        }

        .btn-login {
            width: 100%;
            padding: 0.875rem;
            background: var(--spa-primary);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s, transform 0.1s;
        }

        .btn-login:hover {
            background: var(--spa-primary-dark);
        }

        .btn-login:active {
            transform: translateY(1px);
        }

        .btn-login:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .alert {
            padding: 0.875rem;
            border-radius: 8px;
            margin-bottom: 1.5rem;
            font-size: 0.925rem;
        }

        .alert-error {
            background: rgba(193, 122, 107, 0.1);
            color: var(--spa-error);
            border: 1px solid var(--spa-error);
        }

        .alert-success {
            background: rgba(107, 155, 122, 0.1);
            color: var(--spa-success);
            border: 1px solid var(--spa-success);
        }

        .loading {
            text-align: center;
            color: var(--spa-text-secondary);
            font-size: 0.925rem;
            margin-top: 1rem;
        }

        @media (max-width: 480px) {
            .login-container {
                padding: 2rem 1.5rem;
            }
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="login-header">
            <h1>HTMLSignage Admin</h1>
            <p>Saunalandschaft Westfalenbad Hagen</p>
        </div>

        <?php if (isset($_GET['logged_out'])): ?>
            <div class="alert alert-success">
                Sie wurden erfolgreich abgemeldet.
            </div>
        <?php endif; ?>

        <div id="error-message" class="alert alert-error" style="display: none;"></div>

        <form id="login-form">
            <div class="form-group">
                <label for="username">Benutzername</label>
                <input
                    type="text"
                    id="username"
                    name="username"
                    autocomplete="username"
                    required
                    autofocus
                    placeholder="admin oder meister"
                >
            </div>

            <div class="form-group">
                <label for="password">Passwort</label>
                <input
                    type="password"
                    id="password"
                    name="password"
                    autocomplete="current-password"
                    required
                    placeholder="••••••••"
                >
            </div>

            <div class="checkbox-group">
                <input type="checkbox" id="remember" name="remember">
                <label for="remember">Angemeldet bleiben (30 Tage)</label>
            </div>

            <button type="submit" class="btn-login" id="login-btn">
                Anmelden
            </button>

            <div class="loading" id="loading" style="display: none;">
                Anmeldung läuft...
            </div>
        </form>
    </div>

    <script>
        const form = document.getElementById('login-form');
        const errorMessage = document.getElementById('error-message');
        const loginBtn = document.getElementById('login-btn');
        const loading = document.getElementById('loading');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Clear previous error
            errorMessage.style.display = 'none';

            // Disable button and show loading
            loginBtn.disabled = true;
            loading.style.display = 'block';

            try {
                const formData = new FormData(form);
                const response = await fetch('/admin/api/auth/login_handler.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        username: formData.get('username'),
                        password: formData.get('password'),
                        remember: formData.get('remember') === 'on',
                    }),
                });

                const data = await response.json();

                if (data.success) {
                    // Get return URL or default to admin index
                    const params = new URLSearchParams(window.location.search);
                    const returnUrl = params.get('return') || '/admin/';
                    window.location.href = returnUrl;
                } else {
                    // Show error
                    errorMessage.textContent = data.message || 'Anmeldung fehlgeschlagen';
                    errorMessage.style.display = 'block';
                    loginBtn.disabled = false;
                    loading.style.display = 'none';
                }
            } catch (error) {
                errorMessage.textContent = 'Netzwerkfehler. Bitte versuchen Sie es erneut.';
                errorMessage.style.display = 'block';
                loginBtn.disabled = false;
                loading.style.display = 'none';
            }
        });
    </script>
</body>
</html>
