'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Guard open-redirect: tylko ścieżki wewnętrzne (odrzuć //host i absolutne URL).
  const rawFrom = searchParams.get('from') ?? '/';
  const from = rawFrom.startsWith('/') && !rawFrom.startsWith('//') ? rawFrom : '/';

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Sprawdź czy już zalogowany → redirect
  useEffect(() => {
    fetch('/api/auth/me').then((res) => {
      if (res.ok) router.replace(from);
    });
  }, [from, router]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // Zawsze generyczna odpowiedź — nie zdradzamy czy e-mail jest na liście
      setMessage('Jeśli adres jest na liście, wysłaliśmy kod na Twoją skrzynkę.');
      setStep('code');
    } catch {
      setError('Błąd sieci — spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      if (res.ok) {
        router.replace(from);
      } else {
        const data = await res.json();
        setError(data.error ?? 'Nieprawidłowy kod.');
      }
    } catch {
      setError('Błąd sieci — spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>CFAB 3D Viewer</h1>

        {step === 'email' ? (
          <form onSubmit={handleEmailSubmit} style={styles.form}>
            <p style={styles.subtitle}>Zaloguj się adresem e-mail</p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="twoj@email.com"
              aria-label="Adres e-mail"
              autoComplete="email"
              required
              autoFocus
              style={styles.input}
            />
            <button type="submit" disabled={loading} style={styles.button}>
              {loading ? 'Wysyłanie…' : 'Wyślij kod'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCodeSubmit} style={styles.form}>
            {message && <p style={styles.info}>{message}</p>}
            <p style={styles.subtitle}>Wpisz 6-cyfrowy kod z e-maila</p>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              aria-label="6-cyfrowy kod logowania"
              autoComplete="one-time-code"
              required
              autoFocus
              maxLength={6}
              style={{ ...styles.input, letterSpacing: '8px', textAlign: 'center', fontSize: '24px' }}
            />
            <button type="submit" disabled={loading || code.length < 6} style={styles.button}>
              {loading ? 'Weryfikacja…' : 'Zaloguj się'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('email'); setCode(''); setError(''); }}
              style={styles.link}
            >
              Zmień adres e-mail
            </button>
          </form>
        )}

        {error && <p style={styles.error}>{error}</p>}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: 'var(--bg)',
    fontFamily: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif',
  },
  card: {
    background: 'var(--surface)',
    borderRadius: 12,
    border: '1px solid var(--border)',
    padding: '40px 36px',
    width: '100%',
    maxWidth: 380,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    margin: '0 0 24px',
    color: 'var(--ink)',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--muted)',
    margin: '0 0 16px',
    textAlign: 'center',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid var(--border-strong)',
    borderRadius: 8,
    fontSize: 15,
    color: 'var(--ink)',
    background: 'var(--surface-2)',
    outline: 'none',
    boxSizing: 'border-box',
  },
  button: {
    padding: '11px 0',
    background: 'var(--accent)',
    color: 'var(--accent-ink)',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  link: {
    background: 'none',
    border: 'none',
    color: 'var(--muted)',
    fontSize: 13,
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: '4px 0',
  },
  info: { fontSize: 13, color: 'var(--accent-2)', margin: 0, textAlign: 'center' },
  error: { fontSize: 13, color: 'var(--danger)', margin: '12px 0 0', textAlign: 'center' },
};
