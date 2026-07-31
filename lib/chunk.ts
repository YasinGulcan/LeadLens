const MAX_CHUNK_CHARS = 1200;
const OVERLAP_CHARS = 150;

/**
 * Markdown'ı paragraf sınırlarına saygı göstererek ~MAX_CHUNK_CHARS boyutunda
 * parçalara böler. Tek bir paragraf limiti aşarsa kelime sınırında kesilir.
 */
export function chunkMarkdown(markdown: string): string[] {
  const paragraphs = markdown
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (candidate.length <= MAX_CHUNK_CHARS) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = current.slice(-OVERLAP_CHARS);
    }

    if (paragraph.length <= MAX_CHUNK_CHARS) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    } else {
      // Tek paragraf başlı başına çok uzun: kelime sınırında böl.
      let rest = paragraph;
      while (rest.length > MAX_CHUNK_CHARS) {
        let cut = rest.lastIndexOf(" ", MAX_CHUNK_CHARS);
        if (cut <= 0) cut = MAX_CHUNK_CHARS;
        chunks.push(rest.slice(0, cut).trim());
        rest = rest.slice(Math.max(cut - OVERLAP_CHARS, 0));
      }
      current = rest;
    }
  }

  if (current.trim()) chunks.push(current.trim());

  return chunks.filter((c) => c.length > 20); // gürültü niteliğindeki çok kısa parçaları at
}
