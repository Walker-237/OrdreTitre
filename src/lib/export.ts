/**
 * Couche d'export PDF / Excel — wrappers minces sur jsPDF (avec autotable) et
 * SheetJS (xlsx). Tous les rapports métier (cf. src/lib/reports.ts) en sortent.
 *
 * Choix techniques :
 *   - jsPDF + jspdf-autotable : génération PDF côté client (pas de serveur),
 *     supporte tableaux, en-tête personnalisé, multi-pages.
 *   - xlsx (SheetJS) : génération XLSX côté client. On émet via `Blob` +
 *     download programmatique pour rester compatible Power Apps (pas de
 *     `file-saver`).
 *
 * Tous les exports incluent en bandeau « Afriland First Bank — DAJ » + date
 * d'extraction + nom utilisateur courant si fourni.
 */
import { jsPDF } from 'jspdf';
import autoTable, { type RowInput, type UserOptions } from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import logoUrl from '../assets/Logo_Afriland.png';

/**
 * Logo Afriland — utilisé en en-tête et en filigrane. L'import retourne une
 * data: URL grâce à `assetsInlineLimit: 32_768` dans vite.config.ts (le PNG
 * fait ~10 KB), donc consommable directement par `doc.addImage` sans fetch.
 */
const LOGO_PNG_URL = logoUrl;
/** Ratio largeur/hauteur du logo (387 × 187 px), pour préserver les proportions. */
const LOGO_RATIO = 387 / 187;

/** Format de cellule cible — string ou nombre (laissés bruts dans XLSX). */
export type Cell = string | number | null | undefined;

/** Une section d'un export = un titre + colonnes + lignes. */
export interface ExportSection {
  title: string;
  columns: string[];
  rows: Cell[][];
  /** Texte affiché sous le titre (sous-titre optionnel). */
  note?: string;
}

/** Métadonnées affichées en pied / en-tête d'export. */
export interface ExportMeta {
  /** Titre principal du rapport. */
  titre: string;
  /** Sous-titre (cas d'usage métier). */
  sousTitre?: string;
  /** Auteur (utilisateur connecté qui déclenche l'export). */
  auteur?: string;
  /** Notes en pied de page (filtres appliqués, observations…). */
  notes?: string[];
}

/** Déclenche un téléchargement côté navigateur — réutilisé par PDF et XLSX. */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Slugifie un titre pour usage dans un nom de fichier. */
function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Dessine le logo Afriland centré sur la page courante en filigrane (faible
 * opacité). Couvre ~50 % de la largeur, centré verticalement.
 *
 * Important : on encadre l'appel par `setGState({opacity})` et un reset à
 * 1.0 immédiatement après, sinon **tout** le contenu suivant hérite de
 * l'opacité réduite.
 */
function drawWatermark(doc: jsPDF): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDoc = doc as any;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const wmW = pageW * 0.55;
  const wmH = wmW / LOGO_RATIO;
  const x = (pageW - wmW) / 2;
  const y = (pageH - wmH) / 2;
  // jsPDF expose GState au runtime mais pas dans les .d.ts publics — d'où le `any`.
  if (typeof anyDoc.GState === 'function' && typeof anyDoc.setGState === 'function') {
    anyDoc.setGState(anyDoc.GState({ opacity: 0.06 }));
    doc.addImage(LOGO_PNG_URL, 'PNG', x, y, wmW, wmH);
    anyDoc.setGState(anyDoc.GState({ opacity: 1 }));
  } else {
    // Fallback : on dessine sans transparence (devrait jamais arriver avec jsPDF ≥ 1.5).
    doc.addImage(LOGO_PNG_URL, 'PNG', x, y, wmW, wmH);
  }
}

/**
 * Dessine le bandeau d'en-tête (logo Afriland + raison sociale) sur la page
 * courante. Appelé à la fois après l'init du document et après chaque
 * `addPage()` (via le hook `didDrawPage` d'autotable).
 */
function drawHeader(doc: jsPDF, meta: ExportMeta): void {
  const pageW = doc.internal.pageSize.getWidth();
  // Bandeau rouge fin
  doc.setFillColor(200, 16, 46);
  doc.rect(0, 0, pageW, 18, 'F');
  // Logo à gauche dans le bandeau
  const logoH = 14;
  const logoW = logoH * LOGO_RATIO;
  doc.addImage(LOGO_PNG_URL, 'PNG', 6, 2, logoW, logoH);
  // Texte à droite du logo
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('AFRILAND FIRST BANK', logoW + 12, 8);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Direction des Affaires Juridiques', logoW + 12, 13);
  // Date / auteur à l'extrême droite
  doc.text(
    `Édité le ${new Date().toLocaleString('fr-FR')}${meta.auteur ? ` — par ${meta.auteur}` : ''}`,
    pageW - 6, 12, { align: 'right' },
  );
}

/**
 * Génère un PDF en orientation paysage A4. Multi-sections supportées.
 * Couleur primaire (rouge AFB) : `#C8102E`. Chaque page reçoit :
 *   - un bandeau d'en-tête avec le logo Afriland,
 *   - un filigrane du logo centré (opacité 6 %),
 *   - une pagination en pied.
 */
export function exportPdf(meta: ExportMeta, sections: ExportSection[]): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  // Page 1 : filigrane sous le contenu, puis en-tête au-dessus.
  drawWatermark(doc);
  drawHeader(doc, meta);

  // Titre du rapport
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(meta.titre, 10, 28);
  if (meta.sousTitre) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(meta.sousTitre, 10, 34);
  }

  let cursorY = meta.sousTitre ? 40 : 34;

  for (const section of sections) {
    // Titre de section
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(section.title, 10, cursorY);
    if (section.note) {
      cursorY += 4;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text(section.note, 10, cursorY);
    }
    cursorY += 3;

    autoTable(doc, {
      head: [section.columns],
      body: section.rows.map((r) =>
        r.map((c) => (c === null || c === undefined ? '' : String(c))) as RowInput,
      ),
      startY: cursorY + 2,
      // Marges hautes plus larges pour laisser le bandeau d'en-tête respirer.
      margin: { left: 10, right: 10, top: 22 },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [200, 16, 46], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      theme: 'striped',
      // À chaque nouvelle page créée par autotable : filigrane puis en-tête.
      // Le filigrane vient en premier pour être en arrière-plan ; l'en-tête
      // se superpose ensuite. La table suivra grâce à `margin.top: 22`.
      didDrawPage: () => {
        if (doc.getCurrentPageInfo().pageNumber === 1) return;
        drawWatermark(doc);
        drawHeader(doc, meta);
      },
    } as UserOptions);

    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  if (meta.notes && meta.notes.length > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(110, 110, 110);
    for (const n of meta.notes) {
      if (cursorY > 195) {
        doc.addPage();
        drawWatermark(doc);
        drawHeader(doc, meta);
        cursorY = 24;
      }
      doc.text(`• ${n}`, 10, cursorY);
      cursorY += 4;
    }
  }

  // Pagination
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.text(`Page ${i} / ${pages}`, pageW - 10,
      doc.internal.pageSize.getHeight() - 5, { align: 'right' });
  }

  doc.save(`${slugify(meta.titre)}_${todayIso()}.pdf`);
}

/**
 * Génère un classeur XLSX — une feuille par section.
 * Les valeurs numériques restent typées Number côté Excel.
 */
export function exportExcel(meta: ExportMeta, sections: ExportSection[]): void {
  const wb = XLSX.utils.book_new();

  // Feuille de couverture
  const cover: (string | undefined)[][] = [
    ['Afriland First Bank — Direction des Affaires Juridiques'],
    [meta.titre],
    [meta.sousTitre ?? ''],
    [],
    ['Édité le', new Date().toLocaleString('fr-FR')],
    ['Auteur', meta.auteur ?? '—'],
    [],
    ['Feuilles', ...sections.map((s) => s.title)],
  ];
  if (meta.notes && meta.notes.length > 0) {
    cover.push([]);
    cover.push(['Notes :']);
    for (const n of meta.notes) cover.push([`• ${n}`]);
  }
  const wsCover = XLSX.utils.aoa_to_sheet(cover);
  XLSX.utils.book_append_sheet(wb, wsCover, 'Couverture');

  for (const section of sections) {
    const aoa: Cell[][] = [section.columns, ...section.rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Auto-largeur basique (caractères, plafonné à 60).
    const widths = section.columns.map((col, ci) => {
      const max = section.rows.reduce((m, r) => {
        const v = r[ci];
        const len = v == null ? 0 : String(v).length;
        return Math.max(m, len);
      }, col.length);
      return { wch: Math.min(60, Math.max(8, max + 2)) };
    });
    ws['!cols'] = widths;
    XLSX.utils.book_append_sheet(wb, ws, truncateSheetName(section.title));
  }

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  triggerDownload(blob, `${slugify(meta.titre)}_${todayIso()}.xlsx`);
}

/** Noms de feuille XLSX : max 31 caractères, pas de `[ ] : * ? / \`. */
function truncateSheetName(s: string): string {
  return s.replace(/[[\]:*?/\\]/g, '_').slice(0, 31);
}
