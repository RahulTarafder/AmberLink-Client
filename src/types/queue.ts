import type { Track, UnresolvedTrack } from "./track";
import type { Awaitable } from "./utils";

export interface StoredQueue {
    current: Track | null;
    previous: Track[];
    tracks: (Track | UnresolvedTrack)[];
}

export interface QueueStoreManager {
    /** @async get a Value (MUST RETURN UNPARSED!) */
    get: (guildId: string) => Awaitable<StoredQueue | string | undefined>;
    /** @async Set a value inside a guildId (MUST BE UNPARSED) */
    set: (guildId: string, value: StoredQueue | string) => Awaitable<void | boolean>;
    /** @async Delete a Database Value based of it's guildId */
    delete: (guildId: string) => Awaitable<void | boolean>;
    /** @async Transform the value(s) inside of the QueueStoreManager (IF YOU DON'T NEED PARSING/STRINGIFY, then just return the value) */
    stringify: (value: StoredQueue | string) => Awaitable<StoredQueue | string>;
    /** @async Parse the saved value back to the AmberLinkQueue (IF YOU DON'T NEED PARSING/STRINGIFY, then just return the value) */
    parse: (value: StoredQueue | string) => Awaitable<Partial<StoredQueue>>;
}

export interface ManagerQueueOptions {
    /** Maximum Amount of tracks for the queue.previous array. Set to 0 to not save previous songs. Defaults to 25 Tracks */
    maxPreviousTracks?: number;
    /** Custom AmberLinkQueue Store option */
    queueStore?: QueueStoreManager;
    /** Custom AmberLinkQueue Watcher class */
    queueChangesWatcher?: QueueChangesWatcher;
}

export interface QueueChangesWatcher {
    /** get a Value (MUST RETURN UNPARSED!) */
    tracksAdd: (
        guildId: string,
        tracks: (Track | UnresolvedTrack)[],
        position: number,
        oldStoredQueue: StoredQueue,
        newStoredQueue: StoredQueue,
    ) => void;
    /** Set a value inside a guildId (MUST BE UNPARSED) */
    tracksRemoved: (
        guildId: string,
        tracks: (Track | UnresolvedTrack)[],
        position: number | number[],
        oldStoredQueue: StoredQueue,
        newStoredQueue: StoredQueue,
    ) => void;
    /** Set a value inside a guildId (MUST BE UNPARSED) */
    shuffled: (guildId: string, oldStoredQueue: StoredQueue, newStoredQueue: StoredQueue) => void;
}
