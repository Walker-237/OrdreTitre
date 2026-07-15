import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Logo } from '../components/Logo';

// Logo « Audiences & Délibérés » servi depuis le dossier public/. BASE_URL
// gère le préfixe relatif imposé par le wrapper Power Apps (base: './').
const AUDIENCE_LOGO_URL = `${import.meta.env.BASE_URL}Logo%20audience.jpeg`;

/**
 * Écran de connexion — **dev local uniquement**. En production (player Power Apps),
 * l'authentification se fait avec le compte Microsoft de l'utilisateur et cet écran
 * n'est jamais affiché (cf. src/auth.tsx). Ici : seed local, tout mot de passe accepté.
 */
export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('admin');
  const [password, setPassword] = useState('demo');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(identifier, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de connexion');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={onSubmit}>
        <div style={{
          display: 'flex', justifyContent: 'center', marginBottom: 18,
        }}>
          <img
            src={AUDIENCE_LOGO_URL}
            alt="Audiences & Délibérés"
            style={{
              maxWidth: '100%', width: 260, height: 'auto', display: 'block',
              borderRadius: 8,
            }}
          />
        </div>
        <div className="login-brand" style={{ justifyContent: 'center', marginBottom: 22 }}>
          <div className="brand-mark" style={{ height: 32 }}><Logo /></div>
          <div>
            <div className="login-title">Audiences &amp; Délibérés</div>
            <div className="login-sub">Direction des Affaires Juridiques · AFB</div>
          </div>
        </div>

        <div className="field mb-12">
          <label htmlFor="identifier">Identifiant ou e-mail</label>
          <input
            id="identifier"
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
        </div>

        <div className="field mb-12">
          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <div className="pill red mb-12" style={{ display: 'block', padding: '8px 12px' }}>
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
          {submitting ? 'Connexion…' : 'Se connecter'}
        </button>

        <div className="muted mt-16" style={{ fontSize: 11, textAlign: 'center' }}>
          Mode dev local — comptes : <code>admin</code>, <code>mtopa</code>, <code>pndjock</code>, <code>sotomo</code>.
          <br />En production, connexion via votre compte Microsoft.
        </div>
      </form>
    </div>
  );
}
