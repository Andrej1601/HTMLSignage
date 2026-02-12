import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/config/env';

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFirstUser, setIsFirstUser] = useState(false);
  const [checkingFirstUser, setCheckingFirstUser] = useState(true);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  // Check if this is the first user (no users exist yet)
  useEffect(() => {
    const checkFirstUser = async () => {
      try {
        const response = await fetch(`${API_URL}/api/auth/me`);
        // If 401, no users exist, allow registration
        setIsFirstUser(response.status === 401);
      } catch (error) {
        setIsFirstUser(true);
      } finally {
        setCheckingFirstUser(false);
      }
    };

    checkFirstUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'login') {
        await login({ username, password });
      } else {
        await register({ username, email: email || undefined, password });
      }
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingFirstUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-spa-bg-primary to-spa-bg-secondary">
        <div className="text-spa-text-secondary">Lädt...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-spa-bg-primary to-spa-bg-secondary">
      <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-spa-text-primary mb-2">
            HTMLSignage
          </h1>
          <p className="text-spa-text-secondary">
            {mode === 'login' ? 'Anmelden' : 'Erster Administrator'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-spa-text-primary mb-1">
              Benutzername
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={mode === 'register' ? 3 : 1}
              className="w-full px-3 py-2 border border-spa-bg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-spa-primary focus:border-transparent"
              placeholder="username"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-spa-text-primary mb-1">
                E-Mail (optional)
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-spa-bg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-spa-primary focus:border-transparent"
                placeholder="email@example.com"
              />
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-spa-text-primary mb-1">
              Passwort
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'register' ? 6 : 1}
              className="w-full px-3 py-2 border border-spa-bg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-spa-primary focus:border-transparent"
              placeholder="••••••••"
            />
            {mode === 'register' && (
              <p className="mt-1 text-xs text-spa-text-secondary">
                Mindestens 6 Zeichen
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-spa-primary hover:bg-spa-primary-dark text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Lädt...' : mode === 'login' ? 'Anmelden' : 'Administrator erstellen'}
          </button>
        </form>

        {/* Toggle Mode - Only show if first user */}
        {isFirstUser && (
          <>
            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setError('');
                }}
                className="text-sm text-spa-primary hover:underline"
              >
                {mode === 'login'
                  ? 'Erster Administrator? Jetzt einrichten'
                  : 'Zurück zur Anmeldung'}
              </button>
            </div>

            {/* Info */}
            {mode === 'register' && (
              <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  Dies ist der erste Benutzer und erhält automatisch Administrator-Rechte. Weitere Benutzer können nur von Administratoren angelegt werden.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
