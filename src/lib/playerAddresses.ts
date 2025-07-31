import {PlayerAddressResponse} from "./types";

const PLAYER_ENDPOINT = "https://kromer.reconnected.cc/api/v1/wallet/";

async function get(uri: string): Promise<unknown> {
    const response = await fetch(PLAYER_ENDPOINT + uri);

    if (response.ok) {
        return await response.json();
    } else {
        throw new Error("Not Found!");
    }
}

export async function getByUUID(uuid: string): Promise<PlayerAddressResponse> {
    return await get(`by-player/${uuid}`) as PlayerAddressResponse;
}

export async function getByName(username: string): Promise<PlayerAddressResponse> {
    return await get(`by-name/${username}`) as PlayerAddressResponse;
}
