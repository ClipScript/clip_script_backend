export interface TranscriptResult {
    transcript: string;
    utterances: { text: string }[];
    source: 'captions' | 'assemblyai';
}
