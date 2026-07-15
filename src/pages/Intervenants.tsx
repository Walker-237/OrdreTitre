import { useMemo, useState, type FormEvent } from 'react';
import { useStore } from '../data/store';
import { useAuth } from '../auth';
import { formatMontantCourt, LBL_DIRECTION } from '../labels';
import type { Agent, Avocat } from '../models';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PiecesSection } from '../components/PiecesSection';
import { Pagination, usePagination } from '../components/Pagination';
import { Checkbox, SelectionBar, useRowSelection } from '../components/RowSelection';
import { ImportDialog } from '../components/ImportDialog';
import { AVOCATS_IMPORT } from '../lib/imports/avocats';
import { AGENTS_IMPORT } from '../lib/imports/agents';
import type { AgentInput, AvocatInput } from '../data/source';
import {
  CHARGE_LABEL, CHARGE_PILL, chargeLevel,
  getAgentCounts, getAvocatCounts,
} from '../lib/stats';

type Tab = 'avocats' | 'agents';

// ─── Statut visuel de saturation ───────────────────────────────────────────
function ChargeStatusPill({ actifs, seuil }: { actifs: number; seuil: number }) {
  const lvl = chargeLevel(actifs, seuil);
  const pct = seuil > 0 ? Math.round((actifs * 100) / seuil) : 0;
  return (
    <span className={`pill ${CHARGE_PILL[lvl]}`} style={{ marginTop: 4 }}>
      {CHARGE_LABEL[lvl]} · {pct}%
    </span>
  );
}

// ─── Avocat form ────────────────────────────────────────────────────────────
function emptyAvocat(defaultSeuil: number): AvocatInput {
  return {
    nom: '', prenom: '', cabinet: '', specialites: [],
    telephone: '', email: '', ville: 'Yaoundé',
    seuilDossiersMax: defaultSeuil, dossiersActifs: 0,
    taux: 0, honoraires: 0, isActive: true,
  };
}

function AvocatForm({
  initial, onSubmit, onCancel, submitting, editing, stats, defaultSeuil,
}: {
  initial: AvocatInput; onSubmit: (v: AvocatInput) => void;
  onCancel: () => void; submitting: boolean;
  editing?: Avocat | null;
  stats?: ReturnType<typeof getAvocatCounts>;
  defaultSeuil: number;
}) {
  const [form, setForm] = useState<AvocatInput>(initial);
  const [specStr, setSpecStr] = useState(initial.specialites.join(', '));
  const set = <K extends keyof AvocatInput>(k: K, v: AvocatInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const valid = form.nom.trim().length >= 2 && form.cabinet.trim().length >= 2 && form.email.includes('@');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onSubmit({ ...form, specialites: specStr.split(',').map((s) => s.trim()).filter(Boolean) });
  };

  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <div className="field"><label>Nom</label>
          <input required value={form.nom} onChange={(e) => set('nom', e.target.value)} /></div>
        <div className="field"><label>Prénom</label>
          <input value={form.prenom ?? ''} onChange={(e) => set('prenom', e.target.value)} /></div>
        <div className="field full"><label>Cabinet</label>
          <input required value={form.cabinet} onChange={(e) => set('cabinet', e.target.value)} /></div>
        <div className="field"><label>Barreau</label>
          <input value={form.barreau ?? ''} onChange={(e) => set('barreau', e.target.value || undefined)} /></div>
        <div className="field"><label>N° Barreau</label>
          <input value={form.numeroBarreau ?? ''} onChange={(e) => set('numeroBarreau', e.target.value || undefined)} /></div>
        <div className="field full"><label>Spécialités (séparées par virgules)</label>
          <input value={specStr} onChange={(e) => setSpecStr(e.target.value)} /></div>
        <div className="field"><label>E-mail</label>
          <input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
        <div className="field"><label>Téléphone</label>
          <input value={form.telephone} onChange={(e) => set('telephone', e.target.value)} /></div>
        <div className="field"><label>Ville</label>
          <input value={form.ville} onChange={(e) => set('ville', e.target.value)} /></div>
        <div className="field"><label>
          Seuil dossiers max
          <span className="muted" style={{ fontWeight: 400, marginLeft: 6, fontSize: 11 }}>
            (défaut : {defaultSeuil})
          </span>
        </label>
          <input type="number" min={1} value={form.seuilDossiersMax}
                 onChange={(e) => set('seuilDossiersMax', Number(e.target.value))} />
          <div className="hint">
            Au-delà de ce nombre de dossiers actifs, l'avocat est considéré comme saturé
            (cf. alertes &amp; rapport « Charge avocats »).
          </div>
        </div>
        <div className="field full"><label>
          <input type="checkbox" checked={form.isActive}
                 onChange={(e) => set('isActive', e.target.checked)} /> Actif
        </label></div>
      </div>
      {editing && stats && (
        <>
          <div className="card mt-24">
            <div className="card-title">Charge & portefeuille</div>
            <div className="kpi-grid" style={{ marginBottom: 12 }}>
              <div className="kpi">
                <div className="kpi-label">Dossiers actifs</div>
                <div className="kpi-value" style={{ fontSize: 22 }}>
                  {stats.dossiersActifs} / {form.seuilDossiersMax}
                </div>
                <ChargeStatusPill actifs={stats.dossiersActifs} seuil={form.seuilDossiersMax} />
              </div>
              <div className="kpi">
                <div className="kpi-label">Dossiers inactifs</div>
                <div className="kpi-value" style={{ fontSize: 22 }}>{stats.dossiersInactifs}</div>
                <div className="kpi-trend">Clôturés ou archivés</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Audiences à venir</div>
                <div className="kpi-value" style={{ fontSize: 22 }}>{stats.audiencesAVenir}</div>
                <div className="kpi-trend">{stats.audiencesPassees} passée(s)</div>
              </div>
            </div>
            <div className="progress" title={`${stats.dossiersActifs} / ${form.seuilDossiersMax}`}>
              <span style={{ width: `${Math.min(100, (stats.dossiersActifs * 100) / Math.max(1, form.seuilDossiersMax))}%` }} />
            </div>
          </div>
          <div className="mt-24">
            <PiecesSection
              parentType="AVOCAT"
              parentId={editing.id}
              pieces={editing.pieces ?? []}
              canEdit
              title="Pièces du cabinet"
              description="Convention d'honoraires, mandat, CV, justificatif barreau…"
            />
          </div>
        </>
      )}
      <div className="row mt-24" style={{ justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn btn-primary" disabled={!valid || submitting}>
          {submitting ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

// ─── Agent form ─────────────────────────────────────────────────────────────
function emptyAgent(): AgentInput {
  return {
    nom: '', prenom: '', poste: '', fonction: '', direction: 'DAJ',
    telephone: '', email: '', dossiers: 0, audiences: 0, taux: 0, isActive: true,
  };
}

function AgentForm({
  initial, onSubmit, onCancel, submitting, stats,
}: {
  initial: AgentInput; onSubmit: (v: AgentInput) => void;
  onCancel: () => void; submitting: boolean;
  stats?: ReturnType<typeof getAgentCounts>;
}) {
  const [form, setForm] = useState<AgentInput>(initial);
  const set = <K extends keyof AgentInput>(k: K, v: AgentInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const valid = form.nom.trim().length >= 2 && form.email.includes('@');
  const submit = (e: FormEvent) => { e.preventDefault(); if (valid) onSubmit(form); };

  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <div className="field"><label>Nom</label>
          <input required value={form.nom} onChange={(e) => set('nom', e.target.value)} /></div>
        <div className="field"><label>Prénom</label>
          <input value={form.prenom ?? ''} onChange={(e) => set('prenom', e.target.value)} /></div>
        <div className="field"><label>Matricule</label>
          <input value={form.matricule ?? ''} onChange={(e) => set('matricule', e.target.value || undefined)} /></div>
        <div className="field"><label>Fonction</label>
          <input value={form.fonction} onChange={(e) => set('fonction', e.target.value)} /></div>
        <div className="field"><label>Poste</label>
          <input value={form.poste} onChange={(e) => set('poste', e.target.value)} /></div>
        <div className="field"><label>Direction</label>
          <select value={form.direction} onChange={(e) => set('direction', e.target.value)}>
            {Object.entries(LBL_DIRECTION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        <div className="field"><label>E-mail</label>
          <input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
        <div className="field"><label>Téléphone</label>
          <input value={form.telephone} onChange={(e) => set('telephone', e.target.value)} /></div>
        <div className="field full"><label>
          <input type="checkbox" checked={form.isActive}
                 onChange={(e) => set('isActive', e.target.checked)} /> Actif
        </label></div>
      </div>
      {stats && (
        <div className="card mt-24">
          <div className="card-title">Portefeuille de l'agent</div>
          <div className="kpi-grid">
            <div className="kpi">
              <div className="kpi-label">Dossiers actifs</div>
              <div className="kpi-value" style={{ fontSize: 22 }}>{stats.dossiersActifs}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Dossiers inactifs</div>
              <div className="kpi-value" style={{ fontSize: 22 }}>{stats.dossiersInactifs}</div>
              <div className="kpi-trend">Clôturés ou archivés</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Audiences à venir</div>
              <div className="kpi-value" style={{ fontSize: 22 }}>{stats.audiencesAVenir}</div>
              <div className="kpi-trend">{stats.audiencesPassees} passée(s)</div>
            </div>
          </div>
        </div>
      )}
      <div className="row mt-24" style={{ justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn btn-primary" disabled={!valid || submitting}>
          {submitting ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export function Intervenants() {
  const {
    avocats, agents, dossiers, audiences, juridictions,
    settings, setDefaultSeuilAvocat,
    createAvocat, updateAvocat, deleteAvocat,
    createAgent, updateAgent, deleteAgent,
  } = useStore();
  // Stats live recalculées à chaque rendu — par id pour lookup O(1).
  const avocatStatsById = useMemo(
    () => new Map(avocats.map((a) => [a.id, getAvocatCounts(a.id, dossiers, audiences)])),
    [avocats, dossiers, audiences],
  );
  const agentStatsById = useMemo(
    () => new Map(agents.map((a) => [a.id, getAgentCounts(a.id, dossiers, audiences)])),
    [agents, dossiers, audiences],
  );
  const { can } = useAuth();
  const canManage = can('gererUtilisateurs') || can('modifierDossier');
  const [tab, setTab] = useState<Tab>('avocats');

  // Avocat modals
  const [creatingAv, setCreatingAv] = useState(false);
  const [editingAv, setEditingAv] = useState<Avocat | null>(null);
  const [deletingAv, setDeletingAv] = useState<Avocat | null>(null);
  const [bulkDeletingAv, setBulkDeletingAv] = useState(false);
  // Agent modals
  const [creatingAg, setCreatingAg] = useState(false);
  const [editingAg, setEditingAg] = useState<Agent | null>(null);
  const [deletingAg, setDeletingAg] = useState<Agent | null>(null);
  const [bulkDeletingAg, setBulkDeletingAg] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Import modal (par onglet courant)
  const [importing, setImporting] = useState(false);
  const avPg = usePagination(avocats);
  const agPg = usePagination(agents);
  const avSelection = useRowSelection(avocats, (a) => a.id);
  const agSelection = useRowSelection(agents, (a) => a.id);
  const avPageIds = avPg.pageItems.map((a) => a.id);
  const agPageIds = agPg.pageItems.map((a) => a.id);
  const avAllOnPageSelected = avPageIds.length > 0 && avPageIds.every((id) => avSelection.isSelected(id));
  const avSomeOnPageSelected = !avAllOnPageSelected && avPageIds.some((id) => avSelection.isSelected(id));
  const agAllOnPageSelected = agPageIds.length > 0 && agPageIds.every((id) => agSelection.isSelected(id));
  const agSomeOnPageSelected = !agAllOnPageSelected && agPageIds.some((id) => agSelection.isSelected(id));

  const onCreateAv = async (v: AvocatInput) => {
    setSubmitting(true);
    try { await createAvocat(v); setCreatingAv(false); }
    finally { setSubmitting(false); }
  };
  const onEditAv = async (v: AvocatInput) => {
    if (!editingAv) return;
    setSubmitting(true);
    try { await updateAvocat(editingAv.id, v); setEditingAv(null); }
    finally { setSubmitting(false); }
  };
  const onDeleteAv = async () => {
    if (!deletingAv) return;
    await deleteAvocat(deletingAv.id);
    setDeletingAv(null);
  };
  const onBulkDeleteAv = async () => {
    for (const id of avSelection.selected) await deleteAvocat(id);
    avSelection.clear();
    setBulkDeletingAv(false);
  };
  const onCreateAg = async (v: AgentInput) => {
    setSubmitting(true);
    try { await createAgent(v); setCreatingAg(false); }
    finally { setSubmitting(false); }
  };
  const onEditAg = async (v: AgentInput) => {
    if (!editingAg) return;
    setSubmitting(true);
    try { await updateAgent(editingAg.id, v); setEditingAg(null); }
    finally { setSubmitting(false); }
  };
  const onDeleteAg = async () => {
    if (!deletingAg) return;
    await deleteAgent(deletingAg.id);
    setDeletingAg(null);
  };
  const onBulkDeleteAg = async () => {
    for (const id of agSelection.selected) await deleteAgent(id);
    agSelection.clear();
    setBulkDeletingAg(false);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Intervenants</div>
          <div className="page-subtitle">{avocats.length} avocat(s) · {agents.length} agent(s)</div>
        </div>
        {canManage && (
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn-ghost btn-sm"
                    onClick={() => setImporting(true)}>📥 Importer</button>
            <button className="btn btn-primary"
                    onClick={() => tab === 'avocats' ? setCreatingAv(true) : setCreatingAg(true)}>
              + {tab === 'avocats' ? 'Nouvel avocat' : 'Nouvel agent'}
            </button>
          </div>
        )}
      </div>

      {tab === 'avocats' && canManage && (
        <div className="card mb-20">
          <div className="card-title">Paramètres — charge avocats</div>
          <div className="row wrap" style={{ gap: 16, alignItems: 'center' }}>
            <label style={{ fontSize: 13 }}>
              Seuil par défaut (dossiers actifs max)
              <input type="number" min={1} max={500}
                     value={settings.defaultSeuilAvocat}
                     onChange={(e) => setDefaultSeuilAvocat(Number(e.target.value))}
                     style={{ marginLeft: 10, width: 90, height: 32,
                              padding: '0 10px', border: '1px solid var(--gray-300)',
                              borderRadius: 8, fontSize: 13 }} />
            </label>
            <span className="muted" style={{ fontSize: 12 }}>
              Appliqué automatiquement aux nouveaux avocats. Chaque avocat peut conserver
              un seuil personnalisé via son fiche d'édition.
            </span>
          </div>
        </div>
      )}

      <div className="row" style={{ borderBottom: '1px solid var(--gray-200)', marginBottom: 18 }}>
        <button className="btn btn-ghost" onClick={() => setTab('avocats')}
                style={{ border: 'none', borderBottom: tab === 'avocats' ? '2px solid var(--red)' : '2px solid transparent',
                         borderRadius: 0, color: tab === 'avocats' ? 'var(--black)' : 'var(--gray-500)' }}
                type="button">
          Avocats externes ({avocats.length})
        </button>
        <button className="btn btn-ghost" onClick={() => setTab('agents')}
                style={{ border: 'none', borderBottom: tab === 'agents' ? '2px solid var(--red)' : '2px solid transparent',
                         borderRadius: 0, color: tab === 'agents' ? 'var(--black)' : 'var(--gray-500)' }}
                type="button">
          Agents internes ({agents.length})
        </button>
      </div>

      {tab === 'avocats' ? (
        <div className="table-wrap">
          {canManage && (
            <SelectionBar count={avSelection.count} label="avocat"
                          onDelete={() => setBulkDeletingAv(true)} onClear={avSelection.clear} />
          )}
          <table className="data">
            <thead>
              <tr>
                {canManage && (
                  <th className="col-check">
                    <Checkbox checked={avAllOnPageSelected} indeterminate={avSomeOnPageSelected}
                              ariaLabel="Tout sélectionner"
                              onChange={() => avSelection.toggleMany(avPageIds, !avAllOnPageSelected)} />
                  </th>
                )}
                <th>Avocat</th><th>Cabinet</th><th>Barreau</th>
                <th>Actifs / seuil</th><th>Charge</th>
                <th>Inactifs</th><th>Audiences à venir</th>
                <th>Honoraires</th><th>Statut</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {avPg.pageItems.map((a) => {
                const s = avocatStatsById.get(a.id) ?? { dossiersActifs: 0, dossiersInactifs: 0, dossiersTotal: 0, audiencesAVenir: 0, audiencesPassees: 0 };
                const pct = a.seuilDossiersMax > 0 ? Math.min(100, (s.dossiersActifs * 100) / a.seuilDossiersMax) : 0;
                return (
                  <tr key={a.id}>
                    {canManage && (
                      <td className="col-check">
                        <Checkbox checked={avSelection.isSelected(a.id)}
                                  ariaLabel={`Sélectionner ${a.nom}`}
                                  onChange={() => avSelection.toggle(a.id)} />
                      </td>
                    )}
                    <td className="fw-700">
                      {a.prenom ? `${a.prenom} ${a.nom}` : a.nom}
                      <div className="muted" style={{ fontSize: 11 }}>{a.email}</div>
                    </td>
                    <td>{a.cabinet}</td>
                    <td className="muted">{a.barreau ?? '—'}{a.numeroBarreau ? ` · ${a.numeroBarreau}` : ''}</td>
                    <td>
                      <div className="fw-700">{s.dossiersActifs} / {a.seuilDossiersMax}</div>
                      <div className="progress" style={{ marginTop: 4 }}>
                        <span style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td><ChargeStatusPill actifs={s.dossiersActifs} seuil={a.seuilDossiersMax} /></td>
                    <td><span className="muted">{s.dossiersInactifs}</span></td>
                    <td>{s.audiencesAVenir}<span className="muted" style={{ fontSize: 11 }}> ({s.audiencesPassees} passée(s))</span></td>
                    <td>{formatMontantCourt(a.honoraires)}</td>
                    <td>{a.isActive ? <span className="pill green">Actif</span> : <span className="pill gray">Inactif</span>}</td>
                    {canManage && (
                      <td className="text-right">
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingAv(a)}>Éditer</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
                                onClick={() => setDeletingAv(a)}>Supprimer</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination total={avocats.length} page={avPg.page} pageSize={avPg.pageSize}
                      onPageChange={avPg.setPage} onPageSizeChange={avPg.setPageSize}
                      itemLabel="avocat" />
        </div>
      ) : (
        <div className="table-wrap">
          {canManage && (
            <SelectionBar count={agSelection.count} label="agent"
                          onDelete={() => setBulkDeletingAg(true)} onClear={agSelection.clear} />
          )}
          <table className="data">
            <thead>
              <tr>
                {canManage && (
                  <th className="col-check">
                    <Checkbox checked={agAllOnPageSelected} indeterminate={agSomeOnPageSelected}
                              ariaLabel="Tout sélectionner"
                              onChange={() => agSelection.toggleMany(agPageIds, !agAllOnPageSelected)} />
                  </th>
                )}
                <th>Agent</th><th>Matricule</th><th>Fonction</th><th>Direction</th>
                <th>Dossiers actifs</th><th>Dossiers inactifs</th>
                <th>Audiences à venir</th><th>Statut</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {agPg.pageItems.map((a) => {
                const s = agentStatsById.get(a.id) ?? { dossiersActifs: 0, dossiersInactifs: 0, dossiersTotal: 0, audiencesAVenir: 0, audiencesPassees: 0 };
                return (
                  <tr key={a.id}>
                    {canManage && (
                      <td className="col-check">
                        <Checkbox checked={agSelection.isSelected(a.id)}
                                  ariaLabel={`Sélectionner ${a.nom}`}
                                  onChange={() => agSelection.toggle(a.id)} />
                      </td>
                    )}
                    <td className="fw-700">
                      {a.prenom ? `${a.prenom} ${a.nom}` : a.nom}
                      <div className="muted" style={{ fontSize: 11 }}>{a.email}</div>
                    </td>
                    <td className="muted"><code>{a.matricule ?? '—'}</code></td>
                    <td>{a.fonction}</td>
                    <td>{LBL_DIRECTION[a.direction] ?? a.direction}</td>
                    <td className="fw-700">{s.dossiersActifs}</td>
                    <td className="muted">{s.dossiersInactifs}</td>
                    <td>{s.audiencesAVenir}<span className="muted" style={{ fontSize: 11 }}> ({s.audiencesPassees} passée(s))</span></td>
                    <td>{a.isActive ? <span className="pill green">Actif</span> : <span className="pill gray">Inactif</span>}</td>
                    {canManage && (
                      <td className="text-right">
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingAg(a)}>Éditer</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
                                onClick={() => setDeletingAg(a)}>Supprimer</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination total={agents.length} page={agPg.page} pageSize={agPg.pageSize}
                      onPageChange={agPg.setPage} onPageSizeChange={agPg.setPageSize}
                      itemLabel="agent" />
        </div>
      )}

      <Modal open={creatingAv} title="Nouvel avocat" onClose={() => setCreatingAv(false)}>
        <AvocatForm initial={emptyAvocat(settings.defaultSeuilAvocat)}
                    defaultSeuil={settings.defaultSeuilAvocat}
                    onSubmit={onCreateAv}
                    onCancel={() => setCreatingAv(false)} submitting={submitting} />
      </Modal>
      <Modal open={!!editingAv} title="Éditer l'avocat" onClose={() => setEditingAv(null)} maxWidth={820}>
        {editingAv && (
          <AvocatForm
            initial={{
              utilisateurId: editingAv.utilisateurId, nom: editingAv.nom, prenom: editingAv.prenom,
              cabinet: editingAv.cabinet, numeroBarreau: editingAv.numeroBarreau,
              barreau: editingAv.barreau, specialites: editingAv.specialites,
              telephone: editingAv.telephone, telephoneSecondaire: editingAv.telephoneSecondaire,
              email: editingAv.email, adresse: editingAv.adresse, ville: editingAv.ville,
              seuilDossiersMax: editingAv.seuilDossiersMax, dossiersActifs: editingAv.dossiersActifs,
              taux: editingAv.taux, honoraires: editingAv.honoraires, isActive: editingAv.isActive,
              dateDebutCollaboration: editingAv.dateDebutCollaboration, notes: editingAv.notes,
            }}
            editing={editingAv}
            stats={avocatStatsById.get(editingAv.id)}
            defaultSeuil={settings.defaultSeuilAvocat}
            onSubmit={onEditAv} onCancel={() => setEditingAv(null)} submitting={submitting}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={!!deletingAv} destructive
        title="Supprimer l'avocat"
        message={`Confirmer la suppression de « ${deletingAv?.prenom ?? ''} ${deletingAv?.nom ?? ''} » ?`}
        confirmLabel="Supprimer"
        onConfirm={onDeleteAv} onCancel={() => setDeletingAv(null)}
      />

      <ConfirmDialog
        open={bulkDeletingAv} destructive
        title="Supprimer la sélection"
        message={`Confirmer la suppression de ${avSelection.count} avocat(s) ?`}
        confirmLabel="Supprimer"
        onConfirm={onBulkDeleteAv} onCancel={() => setBulkDeletingAv(false)}
      />

      <Modal open={creatingAg} title="Nouvel agent" onClose={() => setCreatingAg(false)}>
        <AgentForm initial={emptyAgent()} onSubmit={onCreateAg}
                   onCancel={() => setCreatingAg(false)} submitting={submitting} />
      </Modal>
      <Modal open={!!editingAg} title="Éditer l'agent" onClose={() => setEditingAg(null)} maxWidth={820}>
        {editingAg && (
          <AgentForm
            initial={{
              utilisateurId: editingAg.utilisateurId, matricule: editingAg.matricule,
              nom: editingAg.nom, prenom: editingAg.prenom, poste: editingAg.poste,
              fonction: editingAg.fonction, direction: editingAg.direction,
              telephone: editingAg.telephone, email: editingAg.email,
              dossiers: editingAg.dossiers, audiences: editingAg.audiences,
              taux: editingAg.taux, isActive: editingAg.isActive,
              datePriseFonction: editingAg.datePriseFonction, notes: editingAg.notes,
            }}
            stats={agentStatsById.get(editingAg.id)}
            onSubmit={onEditAg} onCancel={() => setEditingAg(null)} submitting={submitting}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={!!deletingAg} destructive
        title="Supprimer l'agent"
        message={`Confirmer la suppression de « ${deletingAg?.prenom ?? ''} ${deletingAg?.nom ?? ''} » ?`}
        confirmLabel="Supprimer"
        onConfirm={onDeleteAg} onCancel={() => setDeletingAg(null)}
      />

      <ConfirmDialog
        open={bulkDeletingAg} destructive
        title="Supprimer la sélection"
        message={`Confirmer la suppression de ${agSelection.count} agent(s) ?`}
        confirmLabel="Supprimer"
        onConfirm={onBulkDeleteAg} onCancel={() => setBulkDeletingAg(false)}
      />

      {/* Import : schéma dépend de l'onglet courant — avocats ou agents. */}
      {tab === 'avocats' ? (
        <ImportDialog
          open={importing}
          onClose={() => setImporting(false)}
          schema={AVOCATS_IMPORT}
          context={{ dossiers, juridictions, avocats, agents }}
          onCommit={(input) => createAvocat(input)}
        />
      ) : (
        <ImportDialog
          open={importing}
          onClose={() => setImporting(false)}
          schema={AGENTS_IMPORT}
          context={{ dossiers, juridictions, avocats, agents }}
          onCommit={(input) => createAgent(input)}
        />
      )}
    </>
  );
}
