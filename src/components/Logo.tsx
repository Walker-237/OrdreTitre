import { useState } from 'react';
import logoUrl from '../assets/Logo_Afriland.png';

/**
 * Logo Afriland First Bank.
 *
 * On importe l'asset comme module ES — Vite le bundle dans `dist/assets/` avec
 * un nom haché et réécrit la référence dans le JS final. Garantit que le path
 * fonctionne quel que soit le sous-chemin sur lequel le Code App est servi
 * (apps.powerapps.com/play/e/.../app/...).
 *
 * Fallback texte « AFB » si l'image échoue à charger (rare — uniquement si la
 * CSP du host bloque les data: ou si l'asset est strippé du bundle).
 */
export function Logo() {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          color: 'var(--red)',
          fontSize: 14,
          letterSpacing: 0.5,
        }}
      >
        AFB
      </span>
    );
  }
  return (
    <img
      src={logoUrl}
      alt="Afriland First Bank"
      onError={() => setFailed(true)}
    />
  );
}
