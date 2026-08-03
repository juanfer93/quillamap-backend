export const EVIDENCE_STORAGE_BUCKET = 'evidence';

export const ALLOWED_EVIDENCE_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const EVIDENCE_IMAGE_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const MAX_EVIDENCE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
