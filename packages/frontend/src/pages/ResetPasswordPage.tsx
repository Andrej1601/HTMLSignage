import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { API_URL } from '@/config/env';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = (searchParams.get('token') || '').trim();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Reset-Token fehlt.');
      return;
    }

    if (password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwoerter stimmen nicht ueberein.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Passwort konnte nicht zurueckgesetzt werden.');
      }

      setIsSuccess(true);
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-spa-bg-primary to-spa-bg-secondary">
      <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-spa-text-primary mb-2">Neues Passwort</h1>
          <p className="text-spa-text-secondary">Setze hier dein neues Passwort.</p>
        </div>

        {!token && (
          <div className="space-y-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              Der Reset-Link ist ungueltig. Bitte fordere einen neuen Link an.
            </div>
            <Link to="/forgot-password" className="block text-center text-sm text-spa-primary hover:underline">
              Neuen Reset-Link anfordern
            </Link>
          </div>
        )}

        {token && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {isSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                Passwort erfolgreich geaendert. Weiterleitung zur Anmeldung...
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-spa-text-primary mb-1">
                Neues Passwort
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-spa-bg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-spa-primary focus:border-transparent"
                placeholder="Mindestens 6 Zeichen"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-spa-text-primary mb-1">
                Passwort wiederholen
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-spa-bg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-spa-primary focus:border-transparent"
                placeholder="Passwort wiederholen"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || isSuccess}
              className="w-full bg-spa-primary hover:bg-spa-primary-dark text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Speichere...' : 'Passwort zuruecksetzen'}
            </button>

            <Link to="/login" className="block text-center text-sm text-spa-primary hover:underline">
              Zurueck zur Anmeldung
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
