const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Decodes the HTML entities that appear in Carleton's responses in a single pass. */
export function decodeEntities(s: string): string {
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] !== "#") return NAMED[code.toLowerCase()] ?? match;
    const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return Number.isInteger(point) && point <= 0x10ffff ? String.fromCodePoint(point) : match;
  });
}

/** Removes tags, leaving the text content. */
export const stripTags = (s: string) => s.replace(/<[^>]*>/g, "");
