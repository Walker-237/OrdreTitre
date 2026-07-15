/**
 * Utilitaires d'upload de pièces jointes aux dossiers.
 *
 * Types acceptés : PDF, JPEG, PNG, GIF, audio (mp3/wav/m4a/ogg/webm), Excel
 * (xls/xlsx). Limite : 5 Mo par fichier (les data: URLs occupent ~33% de plus
 * en localStorage à cause de l'encodage base64).
 *
 * Le contenu binaire est stocké dans `Piece.fichierUrl` sous forme de
 * `data:<mime>;base64,…`. C'est le compromis le plus simple pour la source
 * `seed` (localStorage). Pour SharePoint / Dataverse, l'implémentation
 * uploaderait dans une bibliothèque de documents et stockerait l'URL distante.
 */
import type { TypeDocument } from '../models';

/** Limite de taille par fichier — 5 Mo (∼6.7 Mo en base64). */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ACCEPTED_MIME = new Set([
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const ACCEPTED_EXT = new Set([
  'pdf', 'jpg', 'jpeg', 'png', 'gif',
  'mp3', 'wav', 'm4a', 'ogg', 'webm',
  'xls', 'xlsx',
]);

/** Valeur de l'attribut HTML `accept` de l'input[type=file]. */
export const ACCEPT_ATTRIBUTE = [
  '.pdf', '.jpg', '.jpeg', '.png', '.gif',
  '.mp3', '.wav', '.m4a', '.ogg', '.webm',
  '.xls', '.xlsx',
  'application/pdf', 'image/jpeg', 'image/png', 'image/gif',
  'audio/*',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
].join(',');

export class FileValidationError extends Error {}

function extOf(name: string): string {
  return name.toLowerCase().split('.').pop() ?? '';
}

/** True si le fichier a un MIME ou une extension acceptée. */
export function isAccepted(file: File): boolean {
  if (ACCEPTED_MIME.has(file.type)) return true;
  if (file.type.startsWith('audio/')) return true;
  return ACCEPTED_EXT.has(extOf(file.name));
}

export interface UploadedFile {
  fichierNom: string;
  mimeType: string;
  tailleOctets: number;
  dataUrl: string;
}

/** Lit un fichier en data: URL avec validation type + taille. */
export function readFileAsDataUrl(file: File): Promise<UploadedFile> {
  if (!isAccepted(file)) {
    return Promise.reject(new FileValidationError(
      `Type de fichier non accepté : ${file.type || file.name}. ` +
      'Formats autorisés : PDF, JPEG, PNG, GIF, audio, Excel.',
    ));
  }
  if (file.size > MAX_FILE_SIZE) {
    return Promise.reject(new FileValidationError(
      `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo). ` +
      `Maximum autorisé : ${MAX_FILE_SIZE / 1024 / 1024} Mo.`,
    ));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (typeof r !== 'string') {
        reject(new FileValidationError('Lecture impossible (résultat non-string).'));
        return;
      }
      resolve({
        fichierNom: file.name,
        mimeType: file.type || mimeFromExt(extOf(file.name)),
        tailleOctets: file.size,
        dataUrl: r,
      });
    };
    reader.onerror = () => reject(new FileValidationError('Lecture du fichier interrompue.'));
    reader.readAsDataURL(file);
  });
}

function mimeFromExt(ext: string): string {
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'gif': return 'image/gif';
    case 'mp3': return 'audio/mpeg';
    case 'wav': return 'audio/wav';
    case 'm4a': return 'audio/mp4';
    case 'ogg': return 'audio/ogg';
    case 'webm': return 'audio/webm';
    case 'xls': return 'application/vnd.ms-excel';
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default: return 'application/octet-stream';
  }
}

/** Devine TypeDocument depuis le nom de fichier (mots-clés). */
export function guessTypeDocument(name: string): TypeDocument {
  const n = name.toLowerCase();
  if (n.includes('assignation')) return 'ASSIGNATION';
  if (n.includes('conclusion')) return 'CONCLUSIONS';
  if (n.includes('jugement')) return 'JUGEMENT';
  if (n.includes('ordonnance')) return 'ORDONNANCE';
  if (n.includes('requete') || n.includes('requête')) return 'REQUETE';
  if (n.includes('huissier')) return 'ACTE_HUISSIER';
  if (n.includes('mail') || n.includes('courrier') || n.includes('lettre')) return 'CORRESPONDANCE';
  return 'AUTRE';
}

/** True pour les MIME image (utilisé pour la prévisualisation). */
export function isImageMime(mime: string | undefined): boolean {
  return !!mime && mime.startsWith('image/');
}

/** True pour les MIME audio. */
export function isAudioMime(mime: string | undefined): boolean {
  return !!mime && mime.startsWith('audio/');
}
