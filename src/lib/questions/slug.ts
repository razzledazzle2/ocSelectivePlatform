/**
 * Turns a human name into a URL/slug-safe key.
 * Used when auto-creating topics and question types during import — the DB has
 * a UNIQUE (subject_id, slug) constraint on both tables.
 */
export function slugify(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents (combining diacritical marks)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'item'
}
