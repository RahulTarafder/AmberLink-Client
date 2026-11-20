import type { DestroyReasons, DisconnectReasons } from "../core/constants";
import type { AmberLinkNode } from "../nodes/AmberLinkNode";
import type { EQBand, FilterData, AudioFilterData } from "./filters";
import type { StoredQueue } from "./queue";
import type { Track, UnresolvedTrack } from "./track";
import type { Base64, NodePlayerVoiceOptions } from "./utils";

export type DestroyReasonsType = keyof typeof DestroyReasons | string;

export type DisconnectReasonsType = keyof typeof DisconnectReasons | string;

export interface PlayerJson {
    /** Guild Id where the player was playing in */
    guildId: string;
    /** Options provided to the player */
    options: PlayerOptions;
    /** Voice Channel Id the player was playing in */
    voiceChannelId: string;
    /** Text Channel Id the player was synced to */
    textChannelId?: string;
    /** Position the player was at */
    position: number;
    /** AmberLink server's position the player was at */
    lastPosition: number;
    /** Last time the position was sent from AmberLink server */
    lastPositionChange: number | null;
    /** Volume in % from the player (without volumeDecrementer) */
    volume: number;
    /** Real Volume used in AmberLink server (with the volumeDecrementer) */
    nodeVolume: number;
    /** The repeatmode from the player */
    repeatMode: RepeatMode;
    /** Pause state */
    paused: boolean;
    /** Whether the player was playing or not */
    playing: boolean;
    /** When the player was created */
    createdTimeStamp?: number;
    /** All current used fitlers Data */
    filters: FilterData;
    /** The player's ping object */
    ping: {
        /** Ping to the voice websocket server */
        ws: number;
        /** Avg. calc. Ping to the AmberLink server */
        node: number;
    };
    /** Equalizer Bands used in AmberLink server */
    equalizer: EQBand[];
    /** The Id of the last used node */
    nodeId?: string;
    /** The SessionId of the node */
    nodeSessionId?: string;
    /** The stored queue */
    queue?: StoredQueue;
}

export type RepeatMode = "queue" | "track" | "off";
export interface PlayerOptions {
    /** Guild id of the player */
    guildId: string;
    /** The Voice Channel Id */
    voiceChannelId: string;
    /** The Text Channel Id of the AmberLinkPlayer */
    textChannelId?: string;
    /** instantly change volume with the one play request */
    volume?: number;
    /** VC Region for node selections */
    vcRegion?: string;
    /** if it should join deafened */
    selfDeaf?: boolean;
    /** If it should join muted */
    selfMute?: boolean;
    /** If it should use a specific server node */
    node?: AmberLinkNode | string;
    /** If when applying filters, it should use the insta apply filters fix  */
    instaUpdateFiltersFix?: boolean;
    /** If a volume should be applied via filters instead of AmberLink server-volume */
    applyVolumeAsFilter?: boolean;
    /** Custom Data for the player get/set datastorage */
    customData?: anyObject;
}

export type anyObject = { [key: string | number]: string | number | null | anyObject };

export interface BasePlayOptions {
    /** The position to start the track. */
    position?: number;
    /** The position to end the track. */
    endTime?: number;
    /** If to start "paused" */
    paused?: boolean;
    /** The Volume to start with */
    volume?: number;
    /** The AmberLink server Filters to use | only with the new REST API */
    filters?: Partial<AudioFilterData>;
    /** Voice Update for AmberLink server */
    voice?: NodePlayerVoiceOptions;
}
export interface NodePlayOptions extends BasePlayOptions {
    /** Which Track to play | don't provide, if it should pick from the AmberLinkQueue */
    track?: {
        /** The track encoded base64 string to use instead of the one from the queue system */
        encoded?: Base64 | null; // null stops the current track
        /** The identifier of the track to use */
        identifier?: string;
        /** Custom User Data for the track to provide, will then be on the userData object from the track */
        userData?: anyObject;
        /** The Track requester for when u provide encodedTrack / identifer */
        requester?: unknown;
        /** NodeLink Specific audioTrackId option */
        audioTrackId?: string;
    };
}
export interface PlayOptions extends NodePlayOptions {
    /** Whether to not replace the track if a play payload is sent. */
    noReplace?: boolean;
    /** Adds track on queue and skips to it */
    clientTrack?: (Track | UnresolvedTrack) & { audioTrackId?: string };
}
