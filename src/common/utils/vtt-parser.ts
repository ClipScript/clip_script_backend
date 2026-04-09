// VTT parser for extracting text and timestamped sentences
export function parseVTT(content: string): { text: string; sentences: { start: number; end: number; text: string }[] } {
    const lines = content.split('\n');
    const sentences: { start: number; end: number; text: string }[] = [];
    let text = '';
    const timeRegexp = /^(\d{2}):(\d{2}):(\d{2})\.(\d{3}) --> (\d{2}):(\d{2}):(\d{2})\.(\d{3})/;
    let lastStart: number | null = null;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const match = line.match(timeRegexp);
        if (match) {
            const start =
                parseInt(match[1]) * 3600 +
                parseInt(match[2]) * 60 +
                parseInt(match[3]) +
                parseInt(match[4]) / 1000;
            const end =
                parseInt(match[5]) * 3600 +
                parseInt(match[6]) * 60 +
                parseInt(match[7]) +
                parseInt(match[8]) / 1000;
            let captionText = lines[i + 1]?.trim() || '';
            // Clean up: remove music/non-speech cues, repeated timestamps, empty lines
            if (
                !captionText ||
                captionText === '[Music]' ||
                captionText === '[music]' ||
                captionText === '[MUSIC]' ||
                (captionText.startsWith('[') && captionText.endsWith(']')) ||
                (lastStart !== null && Math.abs(start - lastStart) < 0.01)
            ) {
                continue;
            }
            lastStart = start;
            sentences.push({ start, end, text: captionText });
            text += captionText + ' ';
        }
    }
    return { text: text.trim(), sentences };
}
