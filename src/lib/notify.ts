/**
 * Couche de notification par email -composition + ouverture du client
 * mail de l'utilisateur via `mailto:`. Aucune dépendance backend : le mail
 * part depuis Outlook/Thunderbird/Gmail desktop avec sujet et corps
 * pré-remplis, et l'utilisateur garde la main pour ajuster avant envoi.
 *
 * Choix `mailto:` plutôt que SMTP/Graph :
 *   - Aucun secret à embarquer dans le bundle Power Apps,
 *   - Compatible avec la signature Outlook entreprise (l'utilisateur signe
 *     déjà ses mails -on hérite),
 *   - Audit-friendly : la trace est conservée côté Outlook + côté DAJ via
 *     l'audit local (createNotificationEntry).
 */
import type {
  Agent, Alerte, Audience, Avocat, Delibere, Dossier, Utilisateur,
} from '../models';
import {
  formatDate, formatMontantCourt,
  LBL_NATURE, LBL_RESULTAT_DELIBERE, LBL_STATUT_DELIBERE, LBL_STATUT_DOSSIER,
  LBL_TYPE_AUDIENCE,
} from '../labels';

export interface Recipient {
  id: string;
  /** Libellé affiché dans le sélecteur. */
  label: string;
  email: string;
  category: 'Agent référent' | 'Avocat mandaté' | 'Avocats' | 'Agents' | 'Utilisateurs';
}

export interface MailDraft {
  to: string[];
  cc: string[];
  subject: string;
  body: string;
}

const FOOTER =
  '\n\n-- Direction des Affaires Juridiques - Afriland First Bank\n' +
  'Cet email a ete initie depuis la plateforme Audiences & Deliberes.';

/**
 * Ouvre le client mail par défaut avec un brouillon pré-rempli.
 *
 * Encodage : on construit l'URL manuellement avec `encodeURIComponent`
 * (et NON `URLSearchParams`, qui sérialise les espaces en « + » -affichés
 * littéralement par Outlook). Les sauts de ligne sont normalisés en CRLF
 * (RFC 6068). Le déclenchement se fait via un clic sur une ancre temporaire :
 * `window.open(mailto)` re-parse l'URL et corrompt les caractères multioctets.
 */
export function openMailto(draft: MailDraft): void {
  const enc = (s: string) => encodeURIComponent(s.replace(/\r?\n/g, '\r\n'));
  const params: string[] = [];
  if (draft.cc.length > 0) params.push(`cc=${draft.cc.join(',')}`);
  if (draft.subject) params.push(`subject=${enc(draft.subject)}`);
  if (draft.body) params.push(`body=${enc(draft.body)}`);
  const url = `mailto:${draft.to.join(',')}${params.length ? `?${params.join('&')}` : ''}`;

  const a = document.createElement('a');
  a.href = url;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ────────────────────────────────────────────────────────────────────────────
// Composition -sujets et corps préfabriqués selon le contexte
// ────────────────────────────────────────────────────────────────────────────

const PREFIX = '[AFB-DAJ]';

/** Compose un email à partir d'une alerte (rappel audience, délai recours…). */
export function composeAlerteEmail(
  alerte: Alerte,
  dossier?: Dossier | null,
): { subject: string; body: string } {
  const refDoss = dossier?.reference ?? (alerte.dossier !== '—' ? alerte.dossier : '');
  const sevTag = alerte.severity === 'high' ? ' - URGENT' : '';
  const subject = `${PREFIX} ${alerte.title}${refDoss ? ` - ${refDoss}` : ''}${sevTag}`;

  const lines: string[] = [
    'Bonjour,',
    '',
    alerte.severity === 'high'
      ? "Cette alerte est PRIORITAIRE et nécessite une action immédiate."
      : "Cette alerte requiert votre attention :",
    '',
    `-Type        : ${alerte.title}`,
    `-Description : ${alerte.desc}`,
    `-Échéance    : ${formatDate(alerte.due)}`,
    `-Sévérité    : ${alerte.severity === 'high' ? 'Haute' : alerte.severity === 'medium' ? 'Moyenne' : 'Basse'}`,
  ];

  if (dossier) {
    lines.push('', '--- Dossier concerné ---');
    lines.push(`Référence       : ${dossier.reference}`);
    lines.push(`Intitulé        : ${dossier.intitule}`);
    lines.push(`Statut          : ${LBL_STATUT_DOSSIER[dossier.statut]}`);
    lines.push(`Nature          : ${LBL_NATURE[dossier.nature]}`);
    lines.push(`Juridiction     : ${dossier.juridiction}`);
    lines.push(`Montant en jeu  : ${formatMontantCourt(dossier.montantEnJeu, dossier.devise)}`);
    if (dossier.agent)  lines.push(`Agent référent  : ${dossier.agent}`);
    if (dossier.avocat) lines.push(`Avocat mandaté  : ${dossier.avocat}`);
  }

  lines.push('', "Merci d'effectuer les diligences nécessaires.");
  return { subject, body: lines.join('\n') + FOOTER };
}

/** Compose un email de rappel d'échéance pour un dossier. */
export function composeDossierEcheanceEmail(
  dossier: Dossier,
): { subject: string; body: string } {
  const ech = dossier.prochaineEcheance;
  const days = ech ? Math.round((new Date(ech).getTime() - Date.now()) / 86_400_000) : null;
  const tag = days != null
    ? (days < 0 ? ` - DÉPASSÉE (J+${Math.abs(days)})` : days <= 7 ? ` - J-${days}` : '')
    : '';
  const subject = `${PREFIX} Rappel échéance dossier ${dossier.reference}${tag}`;

  const lines: string[] = [
    'Bonjour,',
    '',
    days != null && days < 0
      ? `L'échéance du dossier ci-dessous est dépassée depuis ${Math.abs(days)} jour(s) :`
      : days != null && days <= 7
        ? `L'échéance du dossier ci-dessous arrive à J-${days} :`
        : "Pour information, l'échéance suivante est à signaler sur ce dossier :",
    '',
    `-Référence   : ${dossier.reference}`,
    `-Intitulé    : ${dossier.intitule}`,
    `-Statut      : ${LBL_STATUT_DOSSIER[dossier.statut]}`,
    `-Nature      : ${LBL_NATURE[dossier.nature]}`,
    `-Juridiction : ${dossier.juridiction}`,
    `-Montant     : ${formatMontantCourt(dossier.montantEnJeu, dossier.devise)}`,
    `-Échéance    : ${formatDate(ech)}`,
  ];
  if (dossier.agent)  lines.push(`-Agent       : ${dossier.agent}`);
  if (dossier.avocat) lines.push(`-Avocat      : ${dossier.avocat}`);
  if (dossier.resumeFaits) {
    lines.push('', '--- Résumé des faits ---', dossier.resumeFaits);
  }
  lines.push('', 'Merci de planifier les diligences nécessaires.');
  return { subject, body: lines.join('\n') + FOOTER };
}

/** Compose un email à partir d'une audience à venir ou passée. */
export function composeAudienceEmail(
  audience: Audience, dossier?: Dossier | null,
): { subject: string; body: string } {
  const refDoss = dossier?.reference ?? '';
  const subject = `${PREFIX} Audience ${LBL_TYPE_AUDIENCE[audience.typeAudience].toLowerCase()} du ${formatDate(audience.date)}${refDoss ? ` - ${refDoss}` : ''}`;

  const lines: string[] = [
    'Bonjour,',
    '',
    "Information audience :",
    '',
    `-Date / heure : ${formatDate(audience.date)} ${audience.heure}`,
    `-Type         : ${LBL_TYPE_AUDIENCE[audience.typeAudience]}`,
    `-Objet        : ${audience.objet}`,
    `-Juridiction  : ${audience.juridiction}`,
  ];
  if (audience.numeroRole)    lines.push(`-N° de rôle   : ${audience.numeroRole}`);
  if (audience.salleAudience) lines.push(`-Salle        : ${audience.salleAudience}`);
  if (audience.agent)         lines.push(`-Agent        : ${audience.agent}`);
  if (dossier) {
    lines.push('', '--- Dossier rattaché ---');
    lines.push(`Référence : ${dossier.reference}`);
    lines.push(`Intitulé  : ${dossier.intitule}`);
  }
  lines.push('', 'Merci de confirmer votre disponibilité ou de signaler toute difficulté.');
  return { subject, body: lines.join('\n') + FOOTER };
}

/** Compose un email pour un délibéré (attendu, rendu, recours imminent). */
export function composeDelibereEmail(
  delibere: Delibere, dossier?: Dossier | null,
): { subject: string; body: string } {
  const refDoss = dossier?.reference ?? '';
  const subject = `${PREFIX} Délibéré du ${formatDate(delibere.dateDelibere)}${refDoss ? ` - ${refDoss}` : ''}`;

  const lines: string[] = [
    'Bonjour,',
    '',
    'Suivi du délibéré ci-dessous :',
    '',
    `-Date prévue   : ${formatDate(delibere.dateDelibere)}`,
    `-Statut        : ${LBL_STATUT_DELIBERE[delibere.statut]}`,
  ];
  if (delibere.dateDelibereEffectif) {
    lines.push(`-Date effective: ${formatDate(delibere.dateDelibereEffectif)}`);
  }
  if (delibere.resultat) lines.push(`-Résultat      : ${LBL_RESULTAT_DELIBERE[delibere.resultat]}`);
  if (delibere.montantAccorde != null)  lines.push(`-Montant accordé : ${formatMontantCourt(delibere.montantAccorde)}`);
  if (delibere.montantCondamne != null) lines.push(`-Montant condamné: ${formatMontantCourt(delibere.montantCondamne)}`);
  if (delibere.dateLimiteRecours) lines.push(`-Délai recours : jusqu'au ${formatDate(delibere.dateLimiteRecours)}`);
  if (delibere.dispositif)        lines.push('', 'Dispositif :', delibere.dispositif);

  if (dossier) {
    lines.push('', '--- Dossier rattaché ---');
    lines.push(`Référence : ${dossier.reference}`);
    lines.push(`Intitulé  : ${dossier.intitule}`);
  }
  lines.push('', 'Merci de prendre en compte ces éléments dans le suivi.');
  return { subject, body: lines.join('\n') + FOOTER };
}

// ────────────────────────────────────────────────────────────────────────────
// Résolution des destinataires possibles depuis le contexte courant
// ────────────────────────────────────────────────────────────────────────────

export interface NotifyContext {
  dossier?: Dossier | null;
  agents: Agent[];
  avocats: Avocat[];
  utilisateurs: Utilisateur[];
}

/**
 * Construit la liste des destinataires proposés, dans l'ordre de pertinence.
 * Les contacts liés directement au dossier (agent référent, avocat mandaté)
 * sont placés en premier -typiquement préselectionnés à l'ouverture.
 */
export function buildRecipientCandidates(ctx: NotifyContext): Recipient[] {
  const list: Recipient[] = [];
  const seen = new Set<string>();
  const push = (r: Recipient) => {
    const key = `${r.category}:${r.email.toLowerCase()}`;
    if (seen.has(key) || !r.email) return;
    seen.add(key);
    list.push(r);
  };

  // 1) Contacts liés au dossier -placés en tête.
  if (ctx.dossier?.agentId) {
    const a = ctx.agents.find((x) => x.id === ctx.dossier!.agentId);
    if (a) push({
      id: a.id,
      label: `${a.prenom ? `${a.prenom} ` : ''}${a.nom}${a.poste ? ` - ${a.poste}` : ''}`,
      email: a.email, category: 'Agent référent',
    });
  }
  if (ctx.dossier?.avocatId) {
    const a = ctx.avocats.find((x) => x.id === ctx.dossier!.avocatId);
    if (a) push({
      id: a.id,
      label: `${a.prenom ? `${a.prenom} ` : ''}${a.nom} - ${a.cabinet}`,
      email: a.email, category: 'Avocat mandaté',
    });
  }

  // 2) Reste des agents (hors agent référent).
  for (const a of ctx.agents) {
    if (!a.isActive) continue;
    push({
      id: a.id,
      label: `${a.prenom ? `${a.prenom} ` : ''}${a.nom}${a.poste ? ` - ${a.poste}` : ''}`,
      email: a.email, category: 'Agents',
    });
  }
  // 3) Reste des avocats.
  for (const a of ctx.avocats) {
    if (!a.isActive) continue;
    push({
      id: a.id,
      label: `${a.prenom ? `${a.prenom} ` : ''}${a.nom} - ${a.cabinet}`,
      email: a.email, category: 'Avocats',
    });
  }
  // 4) Utilisateurs internes.
  for (const u of ctx.utilisateurs) {
    if (!u.isActive) continue;
    push({
      id: u.id,
      label: `${u.nomAffichage} - ${u.role}`,
      email: u.email, category: 'Utilisateurs',
    });
  }
  return list;
}
