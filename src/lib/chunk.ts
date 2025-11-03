export function chunkText(text: string, size = 800, overlap = 100) {
    const chunks: string[] = [];
    let i = 0;
    while (i < text.length) {
        const end = Math.min(i + size, text.length);
        chunks.push(text.slice(i, end));
        i += size - overlap;
    }
    return chunks;
}
