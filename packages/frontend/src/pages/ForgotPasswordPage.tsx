import { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '@/config/env';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error('Passwort-Reset konnte nicht gestartet werden.');
      }

      setIsSubmitted(true);
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
          <h1 className="text-3xl font-bold text-spa-text-primary mb-2">Passwort vergessen</h1>
          <p className="text-spa-text-secondary">
            Wir senden dir einen Reset-Link an deine E-Mail-Adresse.
          </p>
        </div>

        {isSubmitted ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              Falls ein Konto mit dieser E-Mail existiert, wurde ein Passwort-Reset-Link versendet.
            </div>
            <Link
              to="/login"
              className="block text-center w-full bg-spa-primary hover:bg-spa-primary-dark text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Zurück zur Anmeldung
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-spa-text-primary mb-1">
                E-Mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-spa-bg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-spa-primary focus:border-transparent"
                placeholder="email@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-spa-primary hover:bg-spa-primary-dark text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Sende...' : 'Reset-Link senden'}
            </button>

            <Link to="/login" className="block text-center text-sm text-spa-primary hover:underline">
              Zurück zur Anmeldung
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
