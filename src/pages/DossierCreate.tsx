import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../data/store';
import {
  LBL_NATURE, LBL_TYPE_ACTION, LBL_RISQUE, LBL_STATUT_DOSSIER, LBL_TYPE_DOCUMENT,
  tailleHumaine,
} from '../labels';
import {
  NATURE_PROCEDURE, TYPE_ACTION, RISQUE, STATUT_DOSSIER, TYPE_DOCUMENT,
  type NatureProcedure, type Piece, type RisqueLevel, type StatutDossier,
  type TypeAction, type TypeDocument,
} from '../models';
import {
  ACCEPT_ATTRIBUTE, FileValidationError, MAX_FILE_SIZE,
  guessTypeDocument, isAudioMime, isImageMime, readFileAsDataUrl,
} from '../lib/upload';
import { SearchableSelect } from '../components/SearchableSelect';

type PendingPiece = Omit<Piece, 'id' | 'createdAt' | 'dossierId'> & { _key: string };

export function DossierCreate() {
  const { juridictions, agents, avocats, createDossier } = useStore();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    intitule: '',
    nature: 'COMMERCIALE' as NatureProcedure,
    sousNature: '',
    typeAction: 'DEMANDEUR' as TypeAction,
    juridictionId: juridictions[0]?.id ?? '',
    ville: 'Yaoundé',
    montantEnJeu: 0,
    devise: 'XAF',
    statut: 'OUVERT' as StatutDossier,
    agentId: agents[0]?.id ?? '',
    avocatId: avocats[0]?.id ?? '',
    dateOuverture: today,
    prochaineEcheance: today,
    risque: 'MOYEN' as RisqueLevel,
    resumeFaits: '',
  });
  const [pieces, setPieces] = useState<PendingPiece[]>([]);
  const [uploadError, setUploadError] = useState('');

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onPickFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // permet de re-uploader le même fichier
    setUploadError('');
    for (const file of files) {
      try {
        const up = await readFileAsDataUrl(file);
        setPieces((prev) => [...prev, {
          _key: `${Date.now()}-${prev.length}`,
          libelle: file.name,
          typeDocument: guessTypeDocument(file.name),
          fichierNom: up.fichierNom,
          fichierUrl: up.dataUrl,
          mimeType: up.mimeType,
          tailleOctets: up.tailleOctets,
          estConfidentiel: false,
        }]);
      } catch (err) {
        const msg = err instanceof FileValidationError ? err.message : String(err);
        setUploadError(msg);
      }
    }
  };

  const updatePiece = (key: string, patch: Partial<PendingPiece>) =>
    setPieces((prev) => prev.map((p) => (p._key === key ? { ...p, ...patch } : p)));

  const removePiece = (key: string) =>
    setPieces((prev) => prev.filter((p) => p._key !== key));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const jur = juridictions.find((j) => j.id === form.juridictionId);
    const ag = agents.find((a) => a.id === form.agentId);
    const av = avocats.find((a) => a.id === form.avocatId);
    // Strip le _key technique de chaque pièce avant d'envoyer au store.
    const cleanedPieces: Piece[] = pieces.map(({ _key: _k, ...p }) => { void _k; return p as Piece; });
    const created = await createDossier({
      intitule: form.intitule.trim(),
      nature: form.nature,
      sousNature: form.sousNature.trim(),
      typeAction: form.typeAction,
      juridictionId: form.juridictionId,
      juridiction: jur?.libelle ?? '',
      ville: form.ville,
      montantEnJeu: Number(form.montantEnJeu) || 0,
      devise: form.devise,
      statut: form.statut,
      agentId: form.agentId,
      agent: ag ? `${ag.prenom ?? ''} ${ag.nom}`.trim() : '',
      avocatId: form.avocatId,
      avocat: av ? `${av.prenom ?? ''} ${av.nom}`.trim() : '',
      dateOuverture: form.dateOuverture,
      prochaineEcheance: form.prochaineEcheance,
      progress: 0,
      risque: form.risque,
      resumeFaits: form.resumeFaits.trim() || undefined,
      parties: [],
      pieces: cleanedPieces,
    });
    navigate(`/dossiers/${created.id}`);
  };

  const valid = form.intitule.trim().length >= 5 && form.juridictionId && form.agentId;
  const totalSize = pieces.reduce((s, p) => s + (p.tailleOctets ?? 0), 0);

  return (
    <>
      <div className="breadcrumb">
        <Link to="/dossiers">Dossiers</Link> · Nouveau
      </div>
      <div className="page-header">
        <div>
          <div className="page-title">Créer un dossier judiciaire</div>
          <div className="page-subtitle">Référence générée automatiquement à l'enregistrement</div>
        </div>
      </div>

      <form className="card" onSubmit={onSubmit}>
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="intitule">Intitulé</label>
            <input id="intitule" type="text" required minLength={5} maxLength={200}
                   value={form.intitule} onChange={(e) => update('intitule', e.target.value)}
                   placeholder="ex. AFB c/ Sté COCOA TRADERS — Recouvrement" />
          </div>

          <div className="field">
            <label htmlFor="nature">Nature</label>
            <select id="nature" value={form.nature}
                    onChange={(e) => update('nature', e.target.value as NatureProcedure)}>
              {NATURE_PROCEDURE.map((n) => <option key={n} value={n}>{LBL_NATURE[n]}</option>)}
            </select>
          </div>

          <div className="field">
            <label htmlFor="sousNature">Sous-nature</label>
            <input id="sousNature" type="text" maxLength={120}
                   value={form.sousNature} onChange={(e) => update('sousNature', e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="typeAction">Position d'AFB</label>
            <select id="typeAction" value={form.typeAction}
                    onChange={(e) => update('typeAction', e.target.value as TypeAction)}>
              {TYPE_ACTION.map((t) => <option key={t} value={t}>{LBL_TYPE_ACTION[t]}</option>)}
            </select>
          </div>

          <div className="field">
            <label htmlFor="risque">Risque</label>
            <select id="risque" value={form.risque}
                    onChange={(e) => update('risque', e.target.value as RisqueLevel)}>
              {RISQUE.map((r) => <option key={r} value={r}>{LBL_RISQUE[r]}</option>)}
            </select>
          </div>

          <div className="field">
            <label htmlFor="juridictionId">Juridiction</label>
            <SearchableSelect
              id="juridictionId"
              required
              value={form.juridictionId}
              onChange={(v) => update('juridictionId', v)}
              options={juridictions.map((j) => ({ value: j.id, label: j.libelle }))}
            />
          </div>

          <div className="field"><label>Ville</label>
            <input value={form.ville} onChange={(e) => update('ville', e.target.value)} /></div>

          <div className="field"><label>Montant en jeu</label>
            <input type="number" min={0} step={1000} value={form.montantEnJeu}
                   onChange={(e) => update('montantEnJeu', Number(e.target.value))} /></div>

          <div className="field"><label>Devise</label>
            <input maxLength={3} value={form.devise}
                   onChange={(e) => update('devise', e.target.value.toUpperCase())} /></div>

          <div className="field">
            <label>Agent référent</label>
            <SearchableSelect
              required
              value={form.agentId}
              onChange={(v) => update('agentId', v)}
              options={agents.map((a) => ({
                value: a.id,
                label: `${a.prenom ? `${a.prenom} ${a.nom}` : a.nom} — ${a.poste}`,
              }))}
            />
          </div>

          <div className="field">
            <label>Avocat mandaté</label>
            <SearchableSelect
              value={form.avocatId}
              onChange={(v) => update('avocatId', v)}
              placeholder="— Non assigné —"
              options={avocats.map((a) => ({
                value: a.id,
                label: `${a.prenom ? `${a.prenom} ${a.nom}` : a.nom} — ${a.cabinet}`,
              }))}
            />
          </div>

          <div className="field"><label>Date d'ouverture</label>
            <input type="date" value={form.dateOuverture}
                   onChange={(e) => update('dateOuverture', e.target.value)} /></div>

          <div className="field"><label>Prochaine échéance</label>
            <input type="date" value={form.prochaineEcheance}
                   onChange={(e) => update('prochaineEcheance', e.target.value)} /></div>

          <div className="field">
            <label>Statut initial</label>
            <select value={form.statut}
                    onChange={(e) => update('statut', e.target.value as StatutDossier)}>
              {STATUT_DOSSIER.map((s) => <option key={s} value={s}>{LBL_STATUT_DOSSIER[s]}</option>)}
            </select>
          </div>

          <div className="field full"><label>Résumé des faits</label>
            <textarea maxLength={2000} value={form.resumeFaits}
                      onChange={(e) => update('resumeFaits', e.target.value)} /></div>
        </div>

        {/* ─── Pièces jointes ───────────────────────────────────────────── */}
        <div className="mt-24" style={{ borderTop: '1px solid var(--gray-200)', paddingTop: 18 }}>
          <div className="row between mb-12">
            <div>
              <div className="fw-700">Pièces jointes</div>
              <div className="muted" style={{ fontSize: 12 }}>
                PDF, JPEG, PNG, GIF, audio, Excel — {MAX_FILE_SIZE / 1024 / 1024} Mo max par fichier.
                {pieces.length > 0 && <> · {pieces.length} pièce(s) · {tailleHumaine(totalSize)} au total</>}
              </div>
            </div>
            <div>
              <input ref={fileInputRef} type="file" multiple
                     accept={ACCEPT_ATTRIBUTE} style={{ display: 'none' }}
                     onChange={onPickFiles} />
              <button type="button" className="btn btn-ghost"
                      onClick={() => fileInputRef.current?.click()}>
                📎 Joindre des fichiers
              </button>
            </div>
          </div>

          {uploadError && (
            <div className="pill red mb-12"
                 style={{ display: 'block', padding: '8px 12px', whiteSpace: 'normal' }}>
              {uploadError}
            </div>
          )}

          {pieces.length === 0 ? (
            <div className="muted" style={{ fontSize: 12, fontStyle: 'italic' }}>
              Aucune pièce attachée. Tu pourras aussi en ajouter après création depuis la fiche du dossier.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Fichier</th><th>Type</th><th>Libellé</th><th>Confidentiel</th><th>Taille</th><th></th></tr>
                </thead>
                <tbody>
                  {pieces.map((p) => (
                    <tr key={p._key}>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          {isImageMime(p.mimeType) ? (
                            <img src={p.fichierUrl} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--gray-200)' }} />
                          ) : (
                            <span style={{ fontSize: 22 }}>
                              {isAudioMime(p.mimeType) ? '🎵' :
                                p.mimeType === 'application/pdf' ? '📄' :
                                (p.mimeType?.includes('spreadsheet') || p.mimeType?.includes('excel')) ? '📊' : '📎'}
                            </span>
                          )}
                          <code style={{ fontSize: 11 }}>{p.fichierNom}</code>
                        </div>
                      </td>
                      <td>
                        <select value={p.typeDocument}
                                onChange={(e) => updatePiece(p._key, { typeDocument: e.target.value as TypeDocument })}
                                style={{ height: 32, padding: '0 8px', border: '1px solid var(--gray-300)', borderRadius: 6, fontSize: 12 }}>
                          {TYPE_DOCUMENT.map((t) => <option key={t} value={t}>{LBL_TYPE_DOCUMENT[t]}</option>)}
                        </select>
                      </td>
                      <td>
                        <input value={p.libelle}
                               onChange={(e) => updatePiece(p._key, { libelle: e.target.value })}
                               style={{ height: 32, padding: '0 8px', border: '1px solid var(--gray-300)', borderRadius: 6, fontSize: 12, minWidth: 200 }} />
                      </td>
                      <td>
                        <input type="checkbox" checked={p.estConfidentiel}
                               onChange={(e) => updatePiece(p._key, { estConfidentiel: e.target.checked })} />
                      </td>
                      <td className="muted">{tailleHumaine(p.tailleOctets)}</td>
                      <td className="text-right">
                        <button type="button" className="btn btn-ghost btn-sm"
                                style={{ color: 'var(--red)' }}
                                onClick={() => removePiece(p._key)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="row mt-24">
          <button type="submit" className="btn btn-primary" disabled={!valid}>
            Créer le dossier
          </button>
          <Link to="/dossiers" className="btn btn-ghost">Annuler</Link>
        </div>
      </form>
    </>
  );
}
