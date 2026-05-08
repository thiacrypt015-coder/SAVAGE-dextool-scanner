import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';

const BOT_NAME = (import.meta.env.VITE_TELEGRAM_BOT_NAME || '').replace(/^@/, '');

function extractErrorMessage(err: unknown): string {
  const fallback = 'Failed to generate code. Try again.';
  if (!(err instanceof Error) || !err.message) return fallback;
  try {
    const parsed = JSON.parse(err.message);
    return parsed.detail || parsed.error || parsed.message || err.message;
  } catch {
    return err.message;
  }
}

export default function BotLogin() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startLogin = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api.botLoginStart();
      setCode(res.code);
      setExpiresAt(res.expires_at);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!code) return;

    const poll = async () => {
      try {
        const res = await api.botLoginStatus(code);
        if (res.status === 'confirmed' && res.user) {
          stopPolling();
          setUser(res.user);
          navigate('/overview', { replace: true });
        } else if (res.status === 'expired') {
          stopPolling();
          setCode(null);
          setExpiresAt(null);
          setError('Code expired. Generate a new one.');
        }
      } catch {
        /* keep polling */
      }
    };

    timerRef.current = setInterval(poll, 2000);
    return stopPolling;
  }, [code, stopPolling, setUser, navigate]);

  const isExpired =
    expiresAt && new Date(expiresAt).getTime() < Date.now();

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <p className="text-text-muted text-xs text-center leading-relaxed max-w-[280px]">
        If the Telegram widget doesn't work, log in via the bot instead.
      </p>

      {!code ? (
        <button
          onClick={startLogin}
          disabled={loading}
          className="w-full px-4 py-2.5 rounded-lg bg-green/10 border border-green/20 text-green text-sm font-medium hover:bg-green/20 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {loading ? 'Generating…' : 'Get Login Code'}
        </button>
      ) : (
        <div className="flex flex-col items-center gap-2 w-full">
          <div className="bg-bg/60 border border-border rounded-lg px-4 py-3 w-full text-center">
            <p className="text-text-muted text-xs mb-1">Send this code to the bot:</p>
            <code className="text-2xl font-bold tracking-[0.3em] text-green select-all">
              {code}
            </code>
            <p className="text-text-muted text-xs mt-2">
              <code>/login {code}</code>
            </p>
          </div>

          {BOT_NAME && (
            <a
              href={`https://t.me/${BOT_NAME}?start=login_${code}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-center px-4 py-2 rounded-lg bg-green/10 border border-green/20 text-green text-sm font-medium hover:bg-green/20 transition-colors"
            >
              Open @{BOT_NAME} → tap Start to log in
            </a>
          )}

          <p className="text-text-muted text-xs animate-pulse">
            Waiting for confirmation…
          </p>

          {isExpired && (
            <p className="text-xs text-red">Code expired.</p>
          )}

          <button
            onClick={() => {
              stopPolling();
              setCode(null);
              setExpiresAt(null);
              setError('');
              startLogin();
            }}
            className="text-xs text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            Generate new code
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-red bg-red/10 border border-red/20 rounded-lg px-3 py-2 w-full text-center">
          {error}
        </p>
      )}
    </div>
  );
}
