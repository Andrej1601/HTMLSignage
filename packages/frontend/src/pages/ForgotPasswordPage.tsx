import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { fetchApi } from '@/services/api';
import { Button } from '@/components/Button';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await fetchApi('/auth/forgot-password', {
        method: 'POST',
        data: { email },
      });

      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-spa-bg-primary to-spa-bg-secondary">
      <div className="bg-spa-surface p-8 rounded-2xl shadow-2xl max-w-md w-full">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-spa-text-primary mb-2">Passwort vergessen</h1>
          <p className="text-spa-text-secondary">
            Wir senden dir einen Reset-Link an deine E-Mail-Adresse.
          </p>
        </div>

        {isSubmitted ? (
          <div className="space-y-4">
            <div className="p-4 bg-spa-success-light border border-spa-success/30 rounded-lg text-sm text-spa-success-dark">
              Falls ein Konto mit dieser E-Mail existiert, wurde ein Passwort-Reset-Link versendet.
            </div>
            <Link
              to="/login"
              className="flex items-center justify-center w-full rounded-lg bg-spa-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-spa-primary-dark focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-spa-primary focus-visible:ring-offset-2"
            >
              Zurück zur Anmeldung
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div ref={errorRef} tabIndex={-1} role="alert" className="p-3 bg-spa-error-light border border-spa-error/30 rounded-lg text-spa-error-dark text-sm focus:outline-hidden">
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
                className="w-full px-3 py-2 border border-spa-bg-secondary rounded-lg focus:outline-hidden focus:ring-2 focus:ring-spa-primary focus:border-transparent"
                placeholder="email@example.com"
              />
            </div>

            <Button
              type="submit"
              fullWidth
              loading={isLoading}
              loadingText="Sende..."
            >
              Reset-Link senden
            </Button>

            <Link to="/login" className="block text-center text-sm text-spa-primary hover:underline">
              Zurück zur Anmeldung
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
