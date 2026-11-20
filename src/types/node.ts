import type { AmberLinkNode } from "../nodes/AmberLinkNode";
import type { AmberLinkPlayer } from "../player/Player";
import type { NodeLinkEventPayload, NodeLinkEventTypes } from "./nodelink";
import type { DestroyReasonsType } from "./player";
import type { PluginInfo, Track } from "./track";
import type { InvalidNodeRestRequest, NodePlayerData } from "./utils";

/** Ability to manipulate fetch requests */
export type ModifyRequest = (options: RequestInit & { path: string; extraQueryUrlParams?: URLSearchParams }) => void;

export type SponsorBlockSegment =
    | "sponsor"
    | "selfpromo"
    | "interaction"
    | "intro"
    | "outro"
    | "preview"
    | "music_offtopic"
    | "filler";

/**
 * Options for creating an AmberLink server.
 */
export interface AmberLinkNodeOptions {
    /** Specify the node type. Default: AmberLink. */
    nodeType?: NodeType;
    /** The AmberLink server host name or IP address */
    host: string;
    /** The AmberLink server connection port */
    port: number;
    /** The AmberLink server authentication secret */
    authorization: string;
    /** Does the Server use ssl (https) */
    secure?: boolean;
    /** RESUME THE PLAYER? by providing a sessionid on the node-creation */
    sessionId?: string;
    /** Add a Custom ID to the node, for later use */
    id?: string;
    /** Voice Regions of this Node */
    regions?: string[];
    /** The max amount of retries for this node. */
    retryAmount?: number;
    /** The delay of how often to retry a reconnection. */
    retryDelay?: number;
    /** How long a retry is a valid retry, it should be at least retryAmount*retryDelay. if <= 0 (default) then this won't be accounted. */
    retryTimespan?: number;
    /** signal for cancelling requests - default: AbortSignal.timeout(options.requestSignalTimeoutMS || 10000) - put <= 0 to disable */
    requestSignalTimeoutMS?: number;
    /** Close on error */
    closeOnError?: boolean;
    /** Heartbeat interval , set to <= 0 to disable heartbeat system */
    heartBeatInterval?: number;
    /** Recommended, to check whether the client is still connected or not on the stats endpoint */
    enablePingOnStatsCheck?: boolean;
    /** Per Node Options */
    autoChecks?: {
        /** Whether to validate optional modules on third-party server nodes (ignored for NodeLink) */
        pluginValidations?: boolean;
        /** Wether to check for every node to check for source validations or not. */
        sourcesValidations?: boolean;
    };
}

/**
 * Memory statistics reported by an AmberLink server
 */
export interface MemoryStats {
    /** The free memory of the allocated amount. */
    free: number;
    /** The used memory of the allocated amount. */
    used: number;
    /** The total allocated memory. */
    allocated: number;
    /** The reservable memory. */
    reservable: number;
}

/**
 * CPU statistics reported by an AmberLink server
 */
export interface CPUStats {
    /** The core amount the host machine has. */
    cores: number;
    /** The system load. */
    systemLoad: number;
    /** The audio engine process load. */
    nodeLoad: number;
}

/**
 * FrameStats Object from AmberLink server
 */
export interface FrameStats {
    /** The amount of sent frames. */
    sent?: number;
    /** The amount of nulled frames. */
    nulled?: number;
    /** The amount of deficit frames. */
    deficit?: number;
}

/**
 * Base statistics shared by compatible server nodes
 */
export interface BaseNodeStats {
    /** The amount of players on the node. */
    players: number;
    /** The amount of playing players on the node. */
    playingPlayers: number;
    /** The uptime for the node. */
    uptime: number;
    /** The memory stats for the node. */
    memory: MemoryStats;
    /** The cpu stats for the node. */
    cpu: CPUStats;
    /** The frame stats for the node. */
    frameStats: FrameStats;
}

export interface NodeLinkConnectionMetrics {
    status: string;
    metrics: {
        speed: {
            bps: number;
            kbps: number;
            mbps: number;
        };
        downloadedBytes: number;
        durationSeconds: number;
        timestamp: number;
    };
}
/**
 * Interface for nodeStats from AmberLink server
 */
export interface NodeStats extends BaseNodeStats {
    /** The frame stats for the node. */
    frameStats: FrameStats;
    /** something from nodeLink https://nodelink.js.org/docs/differences#detailed-statistics */
    detailedStats?: {
        api: {
            /** e.g. { "/loadtracks": 150, "/info": 5 }  */
            requests: Record<string, number>;
            errors: unknown;
        };
        /** e.g. { "youtube": 150, "soundcloud": 5 } */
        sources: Record<string, number>;
        playback: {
            /** e.g. { "TrackStartEvent": 150, "TrackEndEvent": 5 } */
            events: Record<string, number>;
        };
        /** and potential others */
        [key: string]: unknown;
    };
}

/**
 * Entire AmberLink server information object from AmberLink server
 */

/** First-party AmberLink feature discovery, independent of external module names. */
export interface AmberLinkInfo {
    name: "AmberLink";
    engine: string;
    version: string;
    features: Record<string, boolean | Record<string, boolean>>;
}

export interface AudioNodeInfo {
    /** The version of this AmberLink server */
    version: VersionObject;
    /** The millisecond unix timestamp when this AmberLink server jar was built */
    buildTime: number;
    /** The git information of this AmberLink server */
    git: GitObject;
    /** The JVM version this AmberLink server runs on */
    jvm: string;
    /** The Lavaplayer version being used by this server */
    lavaplayer: string;
    /** The enabled source managers for this server */
    sourceManagers: string[];
    /** The enabled filters for this server */
    filters: string[];
    /** The enabled plugins for this server */
    plugins: PluginObject[];
    /** Something from NodeLink: https://nodelink.js.org/docs/differences#server-info */
    isNodelink?: boolean;
}

/**
 * AmberLink server's version object from AmberLink server
 */
export interface VersionObject {
    /** The full version string of this AmberLink server */
    semver: string;
    /** The major version of this AmberLink server */
    major: number;
    /** The minor version of this AmberLink server */
    minor: number;
    /** The patch version of this AmberLink server */
    patch: number;
    /** The pre-release version according to semver as a . separated list of identifiers */
    preRelease?: string;
    /** The build metadata according to semver as a . separated list of identifiers */
    build?: string;
}

/**
 * Git information object from AmberLink server
 */
export interface GitObject {
    /** The branch this AmberLink server was built on */
    branch: string;
    /** The commit this AmberLink server was built on */
    commit: string;
    /** The millisecond unix timestamp for when the commit was created */
    commitTime: string;
}

/**
 * AmberLink server's plugins object from AmberLink server's plugin
 */
export interface PluginObject {
    /** The name of the plugin */
    name: string;
    /** The version of the plugin */
    version: string;
}

export interface LyricsResult {
    /**The name of the source */
    sourceName: string;
    /**The name of the provider */
    provider: string;
    /**The result text */
    text: string | null;
    /**The lyrics lines */
    lines: LyricsLine[];
    /**Information about the plugin */
    plugin: PluginInfo;
}

export interface LyricsLine {
    /**The millisecond timestamp */
    timestamp: number;
    /**The line duration in milliseconds */
    duration: number | null;
    /**The line text */
    line: string;
    /**Information about the plugin */
    plugin: PluginInfo;
}
export type NodeIdentifier = string;

export interface NodeManagerEvents {
    /**
     * Emitted when a Node is created.
     * @event Manager.nodeManager#create
     */
    create: (node: AmberLinkNode) => void;

    /**
     * Emitted when a Node is destroyed.
     * @event Manager.nodeManager#destroy
     */
    destroy: (node: AmberLinkNode, destroyReason?: DestroyReasonsType) => void;

    /**
     * Emitted when a Node is connected.
     * @event Manager.nodeManager#connect
     */
    connect: (node: AmberLinkNode) => void;

    /**
     * Emitted when a Node is reconnecting.
     * @event Manager.nodeManager#reconnecting
     */
    reconnecting: (node: AmberLinkNode) => void;

    /**
     * Emitted When a node starts to reconnect (if you have a reconnection delay, the reconnecting event will be emitted after the retryDelay.)
     * Useful to check whether the internal node reconnect system works or not
     * @event Manager.nodeManager#reconnectinprogress
     */
    reconnectinprogress: (node: AmberLinkNode) => void;

    /**
     * Emitted when a Node is disconnects.
     * @event Manager.nodeManager#disconnect
     */
    disconnect: (node: AmberLinkNode, reason: { code?: number; reason?: string }) => void;

    /**
     * Emitted when a Node is error.
     * @event Manager.nodeManager#error
     */
    error: (node: AmberLinkNode, error: Error, payload?: unknown) => void;

    /**
     * Emits every single Node event.
     * @event Manager.nodeManager#raw
     */
    raw: (node: AmberLinkNode, payload: unknown) => void;

    /**
     * Emits when the node connects resumed. You then need to create all players within this event for your usecase.
     * Aka for that you need to be able to save player data like vc channel + text channel in a db and then sync it again
     * @event Manager.nodeManager#nodeResumed
     */
    resumed: (
        node: AmberLinkNode,
        payload: { resumed: true; sessionId: string; op: "ready" },
        players: NodePlayerData[] | InvalidNodeRestRequest,
    ) => void;

    /**
     * Event Handler for Nodelink specific events https://nodelink.js.org/docs/api/websocket Fully typed and generic based on the eventName.
     * @event Manager.nodeManager#nodeLinkEvent
     * @example
     *
     * ```ts
     * this.nodeManager.on("nodeLinkEvent", (node, event, player, track, payload) => {
     *   if (event === "SeekEvent") {
     *       console.log("new position:", payload.position);
     *   }
     *   if (event === "FiltersChangedEvent") {
     *       console.log("new filters state", payload.filters);
     *   }
     * });
     * ```
     */
    nodeLinkEvent: (
        ...args: {
            [K in NodeLinkEventTypes]: [
                node: AmberLinkNode,
                event: K,
                player: AmberLinkPlayer,
                track: Track | null,
                payload: NodeLinkEventPayload<K>,
            ];
        }[NodeLinkEventTypes]
    ) => void;
}

export enum ReconnectionState {
    IDLE = "IDLE",
    RECONNECTING = "RECONNECTING",
    PENDING = "PENDING",
    DESTROYING = "DESTROYING",
}

export enum NodeType {
    /** First-party AmberLink engine. This is the default node type. */
    AmberLink = "AmberLink",
    /** A separately operated, third-party AmberLink server. */
    ThirdPartyNode = "ThirdPartyNode",
    /** A NodeLink server using its distinct protocol and capabilities. */
    NodeLink = "NodeLink",
}

