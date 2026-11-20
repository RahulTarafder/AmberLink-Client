import { parse as parseYaml } from "yaml";

import type { AmberLinkPlayer } from "./Player";
import type { Track } from "../types/track";
import type {
    ActiveLyricsLine,
    ActiveLyricsState,
    AmberLinkLyricsLine,
    AmberLinkLyricsPayload,
    AmberLinkLyricsWord,
    LyricsLookupOptions,
    LyricsSyncMode,
    LyricsUpdateListener,
    StopLyricsFollow,
} from "../types/lyrics";

const API = "https://lrclib.net";
const USER_AGENT = "AmberLink Client/1.1.0";
const POSITIVE_TTL = 6 * 60 * 60_000;
const NEGATIVE_TTL = 2 * 60_000;
const CACHE_LIMIT = 1000;
const REQUEST_GAP_MS = 750;

interface CacheEntry {
    expiresAt: number;
    value: AmberLinkLyricsTimeline | null;
}

interface ProviderRecord {
    id?: number;
    trackName?: string;
    artistName?: string;
    albumName?: string;
    duration?: number;
    instrumental?: boolean;
    plainLyrics?: string | null;
    syncedLyrics?: string | null;
    lyricsfile?: string | null;
    hasWordSync?: boolean;
}

export class AmberLinkLyricsTimeline implements AmberLinkLyricsPayload {
    public engine?: string;
    public provider?: string;
    public track: AmberLinkLyricsPayload["track"];
    public instrumental: boolean;
    public syncMode: LyricsSyncMode;
    public hasWordSync: boolean;
    public plainLyrics: string | null;
    public lines: AmberLinkLyricsLine[];

    constructor(payload: AmberLinkLyricsPayload) {
        this.engine = payload.engine;
        this.provider = payload.provider;
        this.track = payload.track;
        this.instrumental = Boolean(payload.instrumental);
        this.syncMode = payload.syncMode;
        this.hasWordSync = Boolean(payload.hasWordSync);
        this.plainLyrics = payload.plainLyrics ?? null;
        this.lines = Array.isArray(payload.lines) ? payload.lines : [];
    }

    /** Returns the lines and word indexes active at an audio position, in milliseconds. */
    public getActiveAt(positionMs: number): ActiveLyricsState {
        const position = Number.isFinite(positionMs) ? Math.max(0, positionMs) : 0;
        const activeLines: ActiveLyricsLine[] = [];

        for (let lineIndex = 0; lineIndex < this.lines.length; lineIndex++) {
            const line = this.lines[lineIndex];
            if (line.startMs === null || line.startMs === undefined) continue;
            if (line.startMs > position) continue;
            const lineEnd = this.effectiveEnd(line.endMs, this.lines[lineIndex + 1]?.startMs ?? null);
            if (lineEnd !== null && position >= lineEnd) continue;

            let currentWordIndex: number | null = null;
            const completedWordIndexes: number[] = [];
            for (let wordIndex = 0; wordIndex < (line.words?.length ?? 0); wordIndex++) {
                const word = line.words[wordIndex];
                if (word.startMs > position) break;
                const wordEnd = this.effectiveWordEnd(line.words, wordIndex, lineEnd);
                if (wordEnd !== null && position >= wordEnd) {
                    completedWordIndexes.push(wordIndex);
                } else {
                    currentWordIndex = wordIndex;
                }
            }
            activeLines.push({ index: lineIndex, text: line.text, currentWordIndex, completedWordIndexes });
        }

        return { positionMs: position, syncMode: this.syncMode, activeLines };
    }

    /** Gets the next exact lyric boundary after a position, including word starts/ends. */
    public getNextBoundaryAfter(positionMs: number): number | null {
        const position = Number.isFinite(positionMs) ? Math.max(0, positionMs) : 0;
        let next = Number.POSITIVE_INFINITY;
        const consider = (value: number | null | undefined) => {
            if (typeof value === "number" && Number.isFinite(value) && value > position && value < next) next = value;
        };

        this.lines.forEach((line, lineIndex) => {
            consider(line.startMs);
            const lineEnd = this.effectiveEnd(line.endMs, this.lines[lineIndex + 1]?.startMs ?? null);
            consider(lineEnd);
            (line.words ?? []).forEach((word, wordIndex) => {
                consider(word.startMs);
                consider(this.effectiveWordEnd(line.words, wordIndex, lineEnd));
            });
        });
        return Number.isFinite(next) ? next : null;
    }

    private effectiveEnd(explicitEnd: number | null, nextStart: number | null): number | null {
        if (explicitEnd !== null && Number.isFinite(explicitEnd)) return explicitEnd;
        return nextStart !== null && Number.isFinite(nextStart) ? nextStart : null;
    }

    private effectiveWordEnd(words: AmberLinkLyricsWord[], index: number, lineEnd: number | null): number | null {
        const word = words[index];
        if (word.endMs !== null && Number.isFinite(word.endMs)) return word.endMs;
        const nextWordStart = words[index + 1]?.startMs;
        if (typeof nextWordStart === "number" && nextWordStart > word.startMs) return nextWordStart;
        return lineEnd;
    }
}

/** Resolve synchronized lyrics independently of the node implementation. */
export class AmberLinkLyricsProvider {
    private readonly cache = new Map<string, CacheEntry>();
    private readonly inFlight = new Map<string, Promise<AmberLinkLyricsTimeline | null>>();
    private nextRequestAt = 0;
    private requestQueue: Promise<void> = Promise.resolve();

    public async get(track: Track, options: LyricsLookupOptions = {}): Promise<AmberLinkLyricsTimeline | null> {
        if (!track?.info || track.info.isStream) return null;
        const title = track.info.title?.trim();
        const artist = (options.artist || track.info.author)?.trim();
        if (!title || !artist) return null;

        const album = options.album || track.pluginInfo?.albumName || undefined;
        const durationSeconds = track.info.duration > 0 ? track.info.duration / 1000 : undefined;
        const key = [normalize(title), normalize(artist), normalize(album || ""), durationSeconds ? Math.round(durationSeconds) : ""].join("|");
        const cached = this.cache.get(key);
        if (cached && cached.expiresAt > Date.now()) return cached.value;
        if (cached) this.cache.delete(key);
        const existing = this.inFlight.get(key);
        if (existing) return existing;

        const request = this.lookup(title, artist, album, durationSeconds, options.wordSync !== false, options.userAgent)
            .then((value) => {
                this.store(key, value, value ? POSITIVE_TTL : NEGATIVE_TTL);
                return value;
            })
            .finally(() => this.inFlight.delete(key));
        this.inFlight.set(key, request);
        return request;
    }

    private async lookup(
        title: string,
        artist: string,
        album: string | undefined,
        durationSeconds: number | undefined,
        wordSync: boolean,
        userAgent?: string,
    ): Promise<AmberLinkLyricsTimeline | null> {
        if (durationSeconds !== undefined) {
            const exact = new URL("/api/get", API);
            exact.searchParams.set("track_name", title);
            exact.searchParams.set("artist_name", artist);
            exact.searchParams.set("duration", String(durationSeconds / 1));
            if (album) exact.searchParams.set("album_name", album);
            try {
                const record = await this.requestJson<ProviderRecord>(exact, userAgent);
                return normalizeProviderRecord(record, wordSync);
            } catch (error) {
                if (!(error instanceof ProviderHttpError) || error.status !== 404) throw error;
            }
        }

        const search = new URL("/api/search", API);
        search.searchParams.set("track_name", title);
        search.searchParams.set("artist_name", artist);
        if (album) search.searchParams.set("album_name", album);
        const candidates = await this.requestJson<ProviderRecord[]>(search, userAgent);
        if (!Array.isArray(candidates)) return null;

        const ranked = candidates.filter((candidate) => {
            if (normalize(candidate.trackName || "") !== normalize(title)) return false;
            if (normalize(candidate.artistName || "") !== normalize(artist)) return false;
            if (durationSeconds !== undefined && typeof candidate.duration === "number") {
                return Math.abs(candidate.duration - durationSeconds) <= 2;
            }
            return true;
        }).sort((a, b) => {
            if (durationSeconds === undefined) return 0;
            return Math.abs((a.duration ?? Number.MAX_SAFE_INTEGER) - durationSeconds)
                - Math.abs((b.duration ?? Number.MAX_SAFE_INTEGER) - durationSeconds);
        });
        if (!ranked.length) return null;

        let selected = ranked[0];
        if (!selected.lyricsfile && selected.id) {
            selected = await this.requestJson<ProviderRecord>(new URL(`/api/get/${selected.id}`, API), userAgent);
        }
        return normalizeProviderRecord(selected, wordSync);
    }

    private requestJson<T>(url: URL, userAgent?: string): Promise<T> {
        const run = this.requestQueue.then(async () => {
            const delay = Math.max(0, this.nextRequestAt - Date.now());
            if (delay) await sleep(delay);
            const response = await fetch(url, {
                headers: { Accept: "application/json", "User-Agent": validUserAgent(userAgent) },
                signal: AbortSignal.timeout(5000),
            });
            this.nextRequestAt = Date.now() + REQUEST_GAP_MS;
            if (response.status === 404) throw new ProviderHttpError(404, "No lyrics record found");
            if (response.status === 429 || response.status === 503) {
                const retryAfter = Number(response.headers.get("retry-after") || 2);
                if (Number.isFinite(retryAfter)) this.nextRequestAt = Math.max(this.nextRequestAt, Date.now() + Math.max(1, retryAfter) * 1000);
                throw new ProviderHttpError(response.status, `Lyrics provider rate-limited; retry after ${retryAfter}s`);
            }
            if (!response.ok) throw new ProviderHttpError(response.status, `Lyrics provider request failed (${response.status})`);
            const text = await response.text();
            if (text.length > 2_000_000) throw new Error("Lyrics response exceeded the 2 MB safety limit");
            return JSON.parse(text) as T;
        });
        this.requestQueue = run.then(() => undefined, () => undefined);
        return run;
    }

    private store(key: string, value: AmberLinkLyricsTimeline | null, ttl: number): void {
        if (this.cache.size >= CACHE_LIMIT) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) this.cache.delete(oldestKey);
        }
        this.cache.set(key, { expiresAt: Date.now() + ttl, value });
    }
}

/** One shared provider keeps the cache and request throttle global across every node in this process. */
export const sharedAmberLinkLyricsProvider = new AmberLinkLyricsProvider();

export function timelineFromLegacyLyrics(value: unknown): AmberLinkLyricsTimeline | null {
    if (!value || typeof value !== "object") return null;
    const payload = value as { lines?: Array<{ line?: string; timestamp?: number; duration?: number | null }>; text?: string | null; provider?: string };
    if (!Array.isArray(payload.lines) || !payload.lines.length) return null;
    const lines: AmberLinkLyricsLine[] = payload.lines
        .filter((line) => typeof line.line === "string")
        .map((line) => ({
            text: line.line!,
            startMs: Number.isFinite(line.timestamp) ? Number(line.timestamp) : null,
            endMs: Number.isFinite(line.timestamp) && Number.isFinite(line.duration)
                ? Number(line.timestamp) + Number(line.duration)
                : null,
            words: [],
        }));
    if (!lines.length) return null;
    return new AmberLinkLyricsTimeline({
        engine: "AmberLink Client",
        provider: payload.provider || "Third-party lyrics source",
        track: { id: null, title: null, artist: null, album: null, durationMs: 0 },
        instrumental: false,
        syncMode: "line",
        hasWordSync: false,
        plainLyrics: payload.text || null,
        lines,
    });
}

export function followLyricsTimeline(player: AmberLinkPlayer, timeline: AmberLinkLyricsTimeline, listener: LyricsUpdateListener): StopLyricsFollow {
    const manager = player.AmberLinkManager as any;
    let timer: NodeJS.Timeout | undefined;
    let stopped = false;
    let lastStateKey = "";

    const clearTimer = () => {
        if (timer) clearTimeout(timer);
        timer = undefined;
    };

    const update = () => {
        if (stopped) return;
        clearTimer();
        const position = player.position;
        const state = timeline.getActiveAt(position);
        const stateKey = JSON.stringify(state.activeLines.map((line) => [line.index, line.currentWordIndex, line.completedWordIndexes]));
        if (stateKey !== lastStateKey) {
            lastStateKey = stateKey;
            listener(state);
        }

        if (player.paused || !player.playing) return;
        const next = timeline.getNextBoundaryAfter(position);
        if (next !== null) timer = setTimeout(update, Math.max(12, Math.min(1000, next - position)));
    };

    const samePlayer = (...args: unknown[]) => args.includes(player);
    const sync = (...args: unknown[]) => { if (samePlayer(...args)) update(); };
    const reset = (...args: unknown[]) => {
        if (!samePlayer(...args)) return;
        lastStateKey = "";
        update();
    };
    const stop = () => {
        if (stopped) return;
        stopped = true;
        clearTimer();
        manager.off("playerUpdate", sync);
        manager.off("playerClientUpdate", sync);
        manager.off("playerPaused", sync);
        manager.off("playerResumed", reset);
        manager.off("trackStart", trackChanged);
        manager.off("trackEnd", reset);
        manager.off("playerDestroy", destroy);
    };
    const destroy = (...args: unknown[]) => { if (samePlayer(...args)) stop(); };
    const trackChanged = (...args: unknown[]) => {
        if (!samePlayer(...args)) return;
        const incoming = args[1] as Track | null | undefined;
        const expectedTitle = normalize(timeline.track.title || "");
        const nextTitle = normalize(incoming?.info?.title || "");
        if (expectedTitle && nextTitle && expectedTitle !== nextTitle) {
            listener({ positionMs: player.position, syncMode: timeline.syncMode, activeLines: [] });
            stop();
            return;
        }
        reset(...args);
    };

    manager.on("playerUpdate", sync);
    manager.on("playerClientUpdate", sync);
    manager.on("playerPaused", sync);
    manager.on("playerResumed", reset);
    manager.on("trackStart", trackChanged);
    manager.on("trackEnd", reset);
    manager.on("playerDestroy", destroy);
    update();

    return stop;
}

export function normalizeProviderRecord(record: ProviderRecord, wordSync = true): AmberLinkLyricsTimeline {
    const durationMs = Math.max(0, Math.round((record.duration || 0) * 1000));
    let plainLyrics = typeof record.plainLyrics === "string" ? record.plainLyrics : null;
    let lines: AmberLinkLyricsLine[] = [];
    let hasWordSync = false;

    if (wordSync && typeof record.lyricsfile === "string" && record.lyricsfile.trim()) {
        try {
            const document = parseYaml(record.lyricsfile) as Record<string, unknown>;
            if (typeof document?.plain === "string" && plainLyrics === null) plainLyrics = document.plain;
            const rawLines = Array.isArray(document?.lines) ? document.lines.slice(0, 1500) : [];
            lines = rawLines.flatMap((raw): AmberLinkLyricsLine[] => {
                if (!raw || typeof raw !== "object") return [];
                const line = raw as Record<string, unknown>;
                if (typeof line.text !== "string" || typeof line.start_ms !== "number" || line.start_ms < 0) return [];
                const words = Array.isArray(line.words) ? line.words.slice(0, 300).flatMap((value): AmberLinkLyricsWord[] => {
                    if (!value || typeof value !== "object") return [];
                    const word = value as Record<string, unknown>;
                    if (typeof word.text !== "string" || typeof word.start_ms !== "number" || word.start_ms < 0) return [];
                    if (typeof word.end_ms === "number" && word.end_ms < word.start_ms) return [];
                    return [{ text: word.text, startMs: word.start_ms, endMs: typeof word.end_ms === "number" ? word.end_ms : null }];
                }) : [];
                words.sort((a, b) => a.startMs - b.startMs);
                if (words.length) hasWordSync = true;
                if (typeof line.end_ms === "number" && line.end_ms < line.start_ms) return [];
                return [{
                    text: line.text,
                    startMs: line.start_ms,
                    endMs: typeof line.end_ms === "number" ? line.end_ms : null,
                    words,
                }];
            });
        } catch {
            // A malformed optional word-timing file must not discard valid LRC/plain lyrics.
        }
    }

    if (!lines.length && typeof record.syncedLyrics === "string") lines = parseLrc(record.syncedLyrics);
    if (!lines.length && plainLyrics) {
        lines = plainLyrics.split(/\r?\n/).filter(Boolean).map((text) => ({ text, startMs: null, endMs: null, words: [] }));
    }
    lines.sort((a, b) => (a.startMs ?? Number.MAX_SAFE_INTEGER) - (b.startMs ?? Number.MAX_SAFE_INTEGER));
    const instrumental = Boolean(record.instrumental);
    const syncMode: LyricsSyncMode = instrumental ? "instrumental" : hasWordSync ? "word" : lines.some((line) => line.startMs !== null) ? "line" : "plain";

    return new AmberLinkLyricsTimeline({
        engine: "AmberLink",
        provider: "LRCLIB",
        track: {
            id: Number.isFinite(record.id) ? Number(record.id) : null,
            title: record.trackName || null,
            artist: record.artistName || null,
            album: record.albumName || null,
            durationMs,
        },
        instrumental,
        syncMode,
        hasWordSync,
        plainLyrics,
        lines,
    });
}

function parseLrc(value: string): AmberLinkLyricsLine[] {
    const result: AmberLinkLyricsLine[] = [];
    const regex = /\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g;
    for (const raw of value.split(/\r?\n/)) {
        const matches = [...raw.matchAll(regex)];
        if (!matches.length) continue;
        const text = raw.replace(regex, "").trim();
        if (!text) continue;
        for (const match of matches) {
            const fraction = (match[3] || "0").padEnd(3, "0").slice(0, 3);
            result.push({
                text,
                startMs: Number(match[1]) * 60_000 + Number(match[2]) * 1000 + Number(fraction),
                endMs: null,
                words: [],
            });
        }
    }
    return result.sort((a, b) => (a.startMs ?? 0) - (b.startMs ?? 0));
}

function normalize(value: string): string {
    return value.toLocaleLowerCase("en-US").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

function validUserAgent(value?: string): string {
    const candidate = typeof value === "string" ? value.trim() : "";
    return candidate.length > 0 && candidate.length <= 240 ? candidate : USER_AGENT;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

class ProviderHttpError extends Error {
    constructor(public readonly status: number, message: string) { super(message); }
}
