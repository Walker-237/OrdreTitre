/**
 * Dialogue de notification par email — pré-remplit destinataires + sujet + corps,
 * laisse l'utilisateur ajuster, puis ouvre son client mail via `mailto:`.
 *
 * Convention : le 1er groupe (« Agent référent », « Avocat mandaté ») est
 * **pré-coché** car il s'agit des contacts directement liés au dossier.
 */
import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import {
  openMailto, type MailDraft, type Recipient,
} from '../lib/notify';

interface NotifyDialogProps {
  open: boolean;
  onClose: () => void;
  /** Titre affiché en en-tête de la modale. */
  title?: string;
  /** Tous les destinataires proposés (ordre = pertinence). */
  candidates: Recipient[];
  /** Sujet pré-rempli. */
  initialSubject: string;
  /** Corps pré-rempli. */
  initialBody: string;
  /** Callback déclenché après ouverture du mailto (audit, fermeture…). */
  onSent?: (draft: MailDraft) => void;
}

const PRESELECT_CATEGORIES = new Set<Recipient['category']>([
  'Agent référent', 'Avocat mandaté',
]);

export function NotifyDialog({
  open, onClose, title = 'Notifier par email',
  candidates, initialSubject, initialBody, onSent,
}: NotifyDialogProps) {
  // Sélection : on stocke les emails pour résister aux ré-ordonnancements.
  const initialSelected = useMemo(
    () => new Set(
      candidates.filter((c) => PRESELECT_CATEGORIES.has(c.category))
                .map((c) => c.email.toLowerCase()),
    ),
    [candidates],
  );
  const [selected, setSelected] = useState<Set<string>>(initialSelected);
  const [extra, setExtra] = useState(''); // emails libres, séparés par , ou ;
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);

  // Si l'utilisateur ouvre une nouvelle alerte, on resynchronise.
  // useMemo + clé interne, mais ici on garde un effet léger via dérivation.
  useMemo(() => { setSubject(initialSubject); setBody(initialBody); setSelected(initialSelected); }, [initialSubject, initialBody, initialSelected]);

  // Groupes pour l'affichage — Agent référent + Avocat mandaté d'abord.
  const groups = useMemo(() => {
    const order: Recipient['category'][] = [
      'Agent référent', 'Avocat mandaté', 'Agents', 'Avocats', 'Utilisateurs',
    ];
    const byCat = new Map<Recipient['category'], Recipient[]>();
    for (const c of candidates) {
      const arr = byCat.get(c.category) ?? [];
      arr.push(c); byCat.set(c.category, arr);
    }
    return order
      .map((cat) => ({ cat, items: byCat.get(cat) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [candidates]);

  function toggle(email: string) {
    const key = email.toLowerCase();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const extraList = useMemo(
    () => extra.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean),
    [extra],
  );
  const invalidExtras = extraList.filter((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));

  // Sépare to (Agent référent + extras) / cc (le reste).
  const draft = useMemo<MailDraft>(() => {
    const to: string[] = [];
    const cc: string[] = [];
    for (const c of candidates) {
      const key = c.email.toLowerCase();
      if (!selected.has(key)) continue;
      if (c.category === 'Agent référent') to.push(c.email);
      else cc.push(c.email);
    }
    for (const e of extraList) to.push(e);
    // Si pas de "to" mais des "cc", promouvoir le premier cc en to.
    if (to.length === 0 && cc.length > 0) to.push(cc.shift()!);
    return { to, cc, subject, body };
  }, [candidates, selected, extraList, subject, body]);

  const canSend = draft.to.length > 0 && subject.trim().length > 0 && invalidExtras.length === 0;

  function send() {
    if (!canSend) return;
    openMailto(draft);
    onSent?.(draft);
    onClose();
  }

  return (
    <Modal open={open} title={title} onClose={onClose} maxWidth={780}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* ── Destinataires ──────────────────────────────────────────── */}
        <div className="field full">
          <label>Destinataires</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {groups.map((g) => (
              <div key={g.cat}>
                <div className="muted" style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: 0.5, marginBottom: 4,
                }}>
                  {g.cat}
                </div>
                <div className="row wrap" style={{ gap: 6 }}>
                  {g.items.map((r) => {
                    const checked = selected.has(r.email.toLowerCase());
                    return (
                      <button
                        key={r.email + r.id}
                        type="button"
                        className={`filter-chip${checked ? ' active' : ''}`}
                        onClick={() => toggle(r.email)}
                        title={r.email}
                      >
                        {checked ? '✓ ' : ''}{r.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {groups.length === 0 && (
              <div className="muted" style={{ fontSize: 12, fontStyle: 'italic' }}>
                Aucun contact disponible — saisir un destinataire ci-dessous.
              </div>
            )}
          </div>
        </div>

        <div className="field full">
          <label>Autres destinataires (séparés par virgule)</label>
          <input value={extra} onChange={(e) => setExtra(e.target.value)}
                 placeholder="prenom.nom@afrilandfirstbank.test, …" />
          {invalidExtras.length > 0 && (
            <div className="hint" style={{ color: 'var(--red)' }}>
              Adresse(s) invalide(s) : {invalidExtras.join(', ')}
            </div>
          )}
        </div>

        {/* ── Sujet ──────────────────────────────────────────────────── */}
        <div className="field full">
          <label>Sujet</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>

        {/* ── Corps ──────────────────────────────────────────────────── */}
        <div className="field full">
          <label>Message</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)}
                    style={{ minHeight: 180, fontFamily: 'inherit', whiteSpace: 'pre-wrap' }} />
        </div>

        <div className="muted" style={{ fontSize: 11 }}>
          {draft.to.length > 0 && <>À : <code>{draft.to.join(', ')}</code></>}
          {draft.cc.length > 0 && <> · Cc : <code>{draft.cc.join(', ')}</code></>}
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button type="button" className="btn btn-primary"
                  disabled={!canSend} onClick={send}>
            📧 Ouvrir dans le client mail
          </button>
        </div>
      </div>
    </Modal>
  );
}
