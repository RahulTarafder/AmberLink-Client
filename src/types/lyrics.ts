export type LyricsSyncMode = "word" | "line" | "plain" | "instrumental";

export interface AmberLinkLyricsWord {
    text: string;
    startMs: number;
    endMs: number | null;
}

export interface AmberLinkLyricsLine {
    text: string;
    startMs: number | null;
    endMs: number | null;
    words: AmberLinkLyricsWord[];
}

export interface AmberLinkLyricsTrack {
    id: number | null;
    title: string | null;
    artist: string | null;
    album: string | null;
    durationMs: number;
}

export interface AmberLinkLyricsPayload {
    engine?: "AmberLink" | string;
    provider?: string;
    track: AmberLinkLyricsTrack;
    instrumental: boolean;
    syncMode: LyricsSyncMode;
    hasWordSync: boolean;
    plainLyrics: string | null;
    lines: AmberLinkLyricsLine[];
}

export interface ActiveLyricsLine {
    index: number;
    text: string;
    currentWordIndex: number | null;
    completedWordIndexes: number[];
}

export interface ActiveLyricsState {
    positionMs: number;
    syncMode: LyricsSyncMode;
    activeLines: ActiveLyricsLine[];
}

export interface LyricsLookupOptions {
    /** Use the provider's word timestamps when the record has them. Defaults to true. */
    wordSync?: boolean;
    /** Fall back to an installed third-party lyrics endpoint when the provider has no result. Defaults to true. */
    legacyFallback?: boolean;
    /** Override metadata when the track's source metadata is incomplete. */
    artist?: string;
    album?: string;
    /** Identify your bot/application to the lyrics provider (include a real project URL or contact). */
    userAgent?: string;
}

export type LyricsUpdateListener = (state: ActiveLyricsState) => void;
export type StopLyricsFollow = () => void;
