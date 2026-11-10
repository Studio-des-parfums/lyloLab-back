/**
 * Decides whether the latest message needs a web search: the user refers to
 * an existing perfume, a brand, a trend or asks for something "like" a
 * reference. Ordinary formulation requests are answered without the web,
 * which is much faster.
 */
const PATTERNS: RegExp[] = [
  // "ressemble à", "qui rappelle", "dans l'esprit de", "à la manière de"…
  /\bressembl\w*/,
  /\brappel(le|ant|er)\b/,
  /\b(inspir\w*|dans l'esprit d|a la maniere d|facon|style d|version d|dupe|clone|copie)\b/,
  /\b(comme|similaire|proche|equivalent|semblable)\b.{0,40}\b(parfum|fragrance|eau de|edp|edt|marque|maison|jus)\b/,
  // Explicit references to the outside world.
  /\b(parfum|fragrance|eau de (parfum|toilette|cologne)|edp|edt)\s+(de|d'|du|des)\s+\S+/,
  /\b(marque|maison de parfum|tendance|best[- ]?seller|succes|lancement|nouveaute|actualite|sorti\w*)\b/,
  /\b(recherche|cherche|trouve|regarde)\w*\b.{0,30}\b(internet|web|en ligne|google)\b/,
  /\b(pyramide olfactive|notes de (tete|coeur|fond)) (de|du|d')/,
  // Well-known houses (lowercased, accents stripped).
  /\b(dior|chanel|guerlain|hermes|lancome|ysl|saint laurent|givenchy|armani|prada|gucci|tom ford|jo malone|le labo|byredo|diptyque|maison margiela|kenzo|mugler|thierry mugler|paco rabanne|rabanne|creed|kilian|frederic malle|serge lutens|l'artisan|nina ricci|cartier|bvlgari|bulgari|calvin klein|hugo boss|jean paul gaultier|gaultier|lancome|valentino|burberry|versace|dolce|carolina herrera|mfk|kurkdjian|baccarat|sauvage|aventus|la vie est belle|black opium|coco mademoiselle|n ?°? ?5|shalimar|angel|terre d'hermes)\b/,
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'");
}

export function needsWebSearch(message: string): boolean {
  const text = normalize(message);
  return PATTERNS.some((pattern) => pattern.test(text));
}
