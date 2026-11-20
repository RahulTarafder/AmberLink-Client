import type { AmberLinkPlayer } from "../player/Player";
import type { UnresolvedSearchResult } from "../types/utils";

interface BandCampAutocompleteTrackObject {
    url?: string;
    uri?: string;
    img?: string;
    band_name?: string;
    name?: string;
    id?: string;
    [name: string]: unknown;
}

export const bandCampSearch = async (player: AmberLinkPlayer, query: string, requestUser: unknown) => {
    let error = null;
    let tracks = [];

    if (player.AmberLinkManager.options.advancedOptions.debugOptions.logCustomSearches)
        console.log(`AmberLink-Client-Debug | SEARCHING | - ${query} on AmberLink Client`);
    player.AmberLinkManager.utils.validateQueryString(player.node, query);

    try {
        const requestUrl = new URL("https://bandcamp.com/api/nusearch/2/autocomplete");
        requestUrl.searchParams.append("q", query);
        const data = await fetch(requestUrl.toString(), {
            headers: {
                "User-Agent": "android-async-http/1.4.1 (http://loopj.com/android-async-http)",
                Cookie: "$Version=1",
            },
        });

        if (!data.ok) throw new Error(`Bandcamp Error: ${data.statusText}`);

        // generate custom error message.
        let json: null | { results: BandCampAutocompleteTrackObject[] } = null;
        try {
            json = (await data.json()) as { results: BandCampAutocompleteTrackObject[] };
        } catch {
            throw new Error("Invalid JSON response from Bandcamp");
        }

        tracks = json?.results
            ?.filter((x) => !!x && typeof x === "object" && "type" in x && x.type === "t")
            .map?.((item) =>
                player.AmberLinkManager.utils.buildUnresolvedTrack(
                    {
                        uri: item.url || item.uri,
                        artworkUrl: item.img,
                        author: item.band_name,
                        title: item.name,
                        identifier: item.id ? `${item.id}` : item.url?.split("/")?.reverse()[0],
                    },
                    requestUser,
                ),
            );
    } catch (e) {
        error = e;
    }

    return {
        loadType: "search",
        exception: error,
        pluginInfo: {},
        playlist: null,
        tracks: tracks,
    } as UnresolvedSearchResult;
};
