import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../data/store';
import { useAuth } from '../auth';
import {
  formatMontantCourt, formatDate,
  LBL_NATURE, LBL_STATUT_DOSSIER, LBL_TYPE_ACTION, LBL_RISQUE,
  LBL_STATUT_AUDIENCE, LBL_TYPE_AUDIENCE,
  LBL_STATUT_DELIBERE, LBL_RESULTAT_DELIBERE,
  LBL_STATUT_PAIEMENT, LBL_QUALITE_PARTIE,
} from '../labels';
import {
  RISQUE, STATUT_DOSSIER,
  type Dossier, type RisqueLevel, type StatutDossier,
} from '../models';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PiecesSection } from '../components/PiecesSection';
import { NotifyDialog } from '../components/NotifyDialog';
import {
  buildRecipientCandidates, composeDossierEcheanceEmail,
  composeAudienceEmail, composeDelibereEmail,
} from '../lib/notify';
import type { Audience, Delibere } from '../models';

function EditDossierForm({
  dossier, onSubmit, onCancel, submitting,
}: {
  dossier: Dossier;
  onSubmit: (patch: Partial<Dossier>) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [form, setForm] = useState({
    intitule: dossier.intitule,
    statut: dossier.statut,
    risque: dossier.risque,
    progress: dossier.progress,
    prochaineEcheance: dossier.prochaineEcheance,
    ville: dossier.ville,
    montantEnJeu: dossier.montantEnJeu,
    observations: dossier.observations ?? '',
    resumeFaits: dossier.resumeFaits ?? '',
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      intitule: form.intitule, statut: form.statut, risque: form.risque,
      progress: Math.max(0, Math.min(100, form.progress)),
      prochaineEcheance: form.prochaineEcheance,
      ville: form.ville, montantEnJeu: Number(form.montantEnJeu),
      observations: form.observations.trim() || undefined,
      resumeFaits: form.resumeFaits.trim() || undefined,
    });
  };

  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <div className="field full"><label>Intitulé</label>
          <input required value={form.intitule} onChange={(e) => set('intitule', e.target.value)} /></div>
        <div className="field"><label>Statut</label>
          <select value={form.statut} onChange={(e) => set('statut', e.target.value as StatutDossier)}>
            {STATUT_DOSSIER.map((s) => <option key={s} value={s}>{LBL_STATUT_DOSSIER[s]}</option>)}
          </select></div>
        <div className="field"><label>Risque</label>
          <select value={form.risque} onChange={(e) => set('risque', e.target.value as RisqueLevel)}>
            {RISQUE.map((r) => <option key={r} value={r}>{LBL_RISQUE[r]}</option>)}
          </select></div>
        <div className="field"><label>Avancement (%)</label>
          <input type="number" min={0} max={100} value={form.progress}
                 onChange={(e) => set('progress', Number(e.target.value))} /></div>
        <div className="field"><label>Prochaine échéance</label>
          <input type="date" value={form.prochaineEcheance}
                 onChange={(e) => set('prochaineEcheance', e.target.value)} /></div>
        <div className="field"><label>Ville</label>
          <input value={form.ville} onChange={(e) => set('ville', e.target.value)} /></div>
        <div className="field"><label>Montant en jeu</label>
          <input type="number" min={0} value={form.montantEnJeu}
                 onChange={(e) => set('montantEnJeu', Number(e.target.value))} /></div>
        <div className="field full"><label>Résumé des faits</label>
          <textarea value={form.resumeFaits} onChange={(e) => set('resumeFaits', e.target.value)} /></div>
        <div className="field full"><label>Observations</label>
          <textarea value={form.observations} onChange={(e) => set('observations', e.target.value)} /></div>
      </div>
      <div className="row mt-24" style={{ justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

type NotifyTarget =
  | { kind: 'dossier' }
  | { kind: 'audience'; audience: Audience }
  | { kind: 'delibere'; delibere: Delibere };

export function DossierDetail() {
  const { id = '' } = useParams();
  const {
    getDossier, audiencesOfDossier, deliberesOfDossier, honorairesOfDossier,
    updateDossier, deleteDossier, agents, avocats, utilisateurs,
  } = useStore();
  const { can } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notify, setNotify] = useState<NotifyTarget | null>(null);

  const dossier = getDossier(id);

  if (!dossier) {
    return (
      <>
        <div className="breadcrumb"><Link to="/dossiers">← Retour aux dossiers</Link></div>
        <div className="empty">
          <div className="em-title">Dossier introuvable</div>
          <div>L'identifiant <code>{id}</code> ne correspond à aucun dossier.</div>
        </div>
      </>
    );
  }

  const d = dossier;
  const audiences = audiencesOfDossier(d.id);
  const deliberes = deliberesOfDossier(d.id);
  const honoraires = honorairesOfDossier(d.id);

  // Destinataires + brouillon mail selon la cible de notification.
  const notifyCandidates = buildRecipientCandidates({ dossier: d, agents, avocats, utilisateurs });
  const notifyDraft = notify
    ? notify.kind === 'audience' ? composeAudienceEmail(notify.audience, d)
    : notify.kind === 'delibere' ? composeDelibereEmail(notify.delibere, d)
    : composeDossierEcheanceEmail(d)
    : null;

  const onEditSubmit = async (patch: Partial<Dossier>) => {
    setSubmitting(true);
    try { await updateDossier(d.id, patch); setEditing(false); }
    finally { setSubmitting(false); }
  };
  const onDelete = async () => {
    await deleteDossier(d.id);
    setDeleting(false);
    navigate('/dossiers');
  };

  const canManagePieces = can('modifierDossier');

  return (
    <>
      <div className="breadcrumb">
        <Link to="/dossiers">Dossiers</Link> · {d.reference}
      </div>
      <div className="page-header">
        <div>
          <div className="page-title">{d.intitule}</div>
          <div className="page-subtitle">
            Réf. <code>{d.reference}</code> · ouvert le {formatDate(d.dateOuverture)}
          </div>
        </div>
        <div className="row">
          <span className="pill">{LBL_STATUT_DOSSIER[d.statut]}</span>
          <span className={`pill ${d.risque === 'ELEVE' ? 'red' : d.risque === 'MOYEN' ? 'orange' : 'green'}`}>
            Risque {LBL_RISQUE[d.risque]}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setNotify({ kind: 'dossier' })}>
            📧 Notifier l'échéance
          </button>
          {can('modifierDossier') && (
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Éditer</button>
          )}
          {can('archiverDossier') && (
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
                    onClick={() => setDeleting(true)}>Supprimer</button>
          )}
        </div>
      </div>

      <div className="detail-grid">
        <div>
          <div className="card mb-20">
            <div className="card-title">Caractéristiques</div>
            <div className="kv-list">
              <div className="kv-row"><span className="k">Nature</span><span className="v">{LBL_NATURE[d.nature]}</span></div>
              <div className="kv-row"><span className="k">Sous-nature</span><span className="v">{d.sousNature}</span></div>
              <div className="kv-row"><span className="k">Position d'AFB</span><span className="v">{LBL_TYPE_ACTION[d.typeAction]}</span></div>
              <div className="kv-row"><span className="k">Juridiction</span><span className="v">{d.juridiction}</span></div>
              <div className="kv-row"><span className="k">Ville</span><span className="v">{d.ville}</span></div>
              <div className="kv-row"><span className="k">Montant en jeu</span><span className="v">{formatMontantCourt(d.montantEnJeu, d.devise)}</span></div>
              <div className="kv-row"><span className="k">Agent référent</span><span className="v">{d.agent}</span></div>
              <div className="kv-row"><span className="k">Avocat mandaté</span><span className="v">{d.avocat}</span></div>
              <div className="kv-row"><span className="k">Avancement</span><span className="v">{d.progress}%</span></div>
              <div className="kv-row"><span className="k">Prochaine échéance</span><span className="v">{formatDate(d.prochaineEcheance)}</span></div>
            </div>
            {d.resumeFaits && (<>
              <div className="card-title mt-24">Résumé des faits</div>
              <p className="muted" style={{ lineHeight: 1.55 }}>{d.resumeFaits}</p>
            </>)}
            {d.observations && (<>
              <div className="card-title mt-24">Observations</div>
              <p className="muted" style={{ lineHeight: 1.55 }}>{d.observations}</p>
            </>)}
          </div>

          {d.parties.length > 0 && (
            <div className="card mb-20">
              <div className="card-title">Parties</div>
              <table className="data">
                <thead><tr><th>Nom / Raison sociale</th><th>Qualité</th><th>Coordonnées</th></tr></thead>
                <tbody>
                  {d.parties.map((p, i) => (
                    <tr key={p.id ?? i}>
                      <td className="fw-700">{p.nomRaisonSociale}{p.prenom ? ` ${p.prenom}` : ''}</td>
                      <td><span className="pill">{LBL_QUALITE_PARTIE[p.qualiteDansDossier]}</span></td>
                      <td className="muted">{p.telephone ?? p.email ?? p.adresse ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <PiecesSection
            parentType="DOSSIER"
            parentId={d.id}
            pieces={d.pieces}
            canEdit={canManagePieces}
            title="Pièces du dossier"
          />
        </div>

        <div>
          <div className="card mb-20">
            <div className="card-title">Audiences ({audiences.length})</div>
            {audiences.length === 0 ? (
              <div className="muted" style={{ fontSize: 12 }}>Aucune audience.</div>
            ) : (
              <div className="kv-list">
                {audiences.map((a) => (
                  <div key={a.id} className="kv-row">
                    <span className="k">
                      {formatDate(a.date)} · {a.heure}<br />
                      <span style={{ fontSize: 11 }}>{LBL_TYPE_AUDIENCE[a.typeAudience]}</span>
                    </span>
                    <span className="v" style={{ textAlign: 'right' }}>
                      <span className="pill">{LBL_STATUT_AUDIENCE[a.statut]}</span><br />
                      <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>{a.objet}</span><br />
                      <button className="btn btn-ghost btn-sm" style={{ marginTop: 4 }}
                              onClick={() => setNotify({ kind: 'audience', audience: a })}>
                        📧 Notifier
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card mb-20">
            <div className="card-title">Délibérés ({deliberes.length})</div>
            {deliberes.length === 0 ? (
              <div className="muted" style={{ fontSize: 12 }}>Aucun délibéré.</div>
            ) : (
              <div className="kv-list">
                {deliberes.map((de) => (
                  <div key={de.id} className="kv-row">
                    <span className="k">
                      {formatDate(de.dateDelibere)}<br />
                      <span style={{ fontSize: 11 }}>{LBL_STATUT_DELIBERE[de.statut]}</span>
                    </span>
                    <span className="v" style={{ textAlign: 'right' }}>
                      {de.resultat ? <span className="pill green">{LBL_RESULTAT_DELIBERE[de.resultat]}</span> : '—'}<br />
                      <button className="btn btn-ghost btn-sm" style={{ marginTop: 4 }}
                              onClick={() => setNotify({ kind: 'delibere', delibere: de })}>
                        📧 Notifier
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">Honoraires ({honoraires.length})</div>
            {honoraires.length === 0 ? (
              <div className="muted" style={{ fontSize: 12 }}>Aucune facture.</div>
            ) : (
              <div className="kv-list">
                {honoraires.map((h) => (
                  <div key={h.id} className="kv-row">
                    <span className="k">
                      <code>{h.referenceFacture ?? h.id}</code><br />
                      <span style={{ fontSize: 11 }}>{formatDate(h.dateFacture)}</span>
                    </span>
                    <span className="v" style={{ textAlign: 'right' }}>
                      {formatMontantCourt(h.montantFacture)}<br />
                      <span className="pill" style={{ fontSize: 10 }}>{LBL_STATUT_PAIEMENT[h.statutPaiement]}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal open={editing} title="Éditer le dossier" onClose={() => setEditing(false)} maxWidth={780}>
        <EditDossierForm dossier={d} onSubmit={onEditSubmit}
                         onCancel={() => setEditing(false)} submitting={submitting} />
      </Modal>
      <ConfirmDialog
        open={deleting} destructive
        title="Supprimer le dossier"
        message={`Confirmer la suppression de ${d.reference} ? Les audiences, délibérés et honoraires liés seront également supprimés.`}
        confirmLabel="Supprimer"
        onConfirm={onDelete} onCancel={() => setDeleting(false)}
      />

      {notifyDraft && (
        <NotifyDialog
          open={!!notify}
          onClose={() => setNotify(null)}
          title={
            notify?.kind === 'audience' ? "Notifier l'audience"
            : notify?.kind === 'delibere' ? 'Notifier le délibéré'
            : "Notifier l'échéance du dossier"
          }
          candidates={notifyCandidates}
          initialSubject={notifyDraft.subject}
          initialBody={notifyDraft.body}
        />
      )}
    </>
  );
}
