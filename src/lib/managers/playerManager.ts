import {Player, PlayerWithStatus} from "../models";
import {User} from "reconnectedchat";
import {getByUUID} from "../playerAddresses";
import {rcc} from "../../chat";

const REFRESH_INTERVAL = 3 * 24 * 60 * 60 * 1000; // 3 days

class PlayerManager {
    private players: Player[] = [];

    private async updatePlayers() {
        this.players = await Player.findAll();
    }

    constructor() {
        this.updatePlayers().catch(console.error);
    }

    public async getPlayerFromUser(user: User): Promise<Player|null> {
        let player = this.players.find(p => p.minecraftUUID === user.uuid) ?? null;
        if (!player || !player.updatedAt || player.updatedAt.getTime() + REFRESH_INTERVAL < Date.now()) {
            try {
                const address = await getByUUID(user.uuid);
                if (address && address.data.length > 0) {
                    if (player) {
                        console.log("Updating player " + user.name);
                        player.minecraftName = user.name;
                        player.kromerAddress = address.data[0].address;
                        player.updatedAt = new Date();
                        await player.save();
                    } else {
                        console.log("Creating player " + user.name);
                        player = await Player.create({
                            minecraftUUID: user.uuid,
                            minecraftName: user.name,
                            kromerAddress: address.data[0].address,
                        });
                        this.players.push(player);
                    }
                } else {
                    console.error("Could not get address for " + user.name);
                }
            } catch(err) {
                console.error("Could not get address for " + user.name, err);
            }
        }
        return player;
    }

    private wrapPlayer(player: Player): PlayerWithStatus {
        return {
            ...player.raw(),
            online: Boolean(rcc.players.find(p => p.uuid === player.minecraftUUID)),
        } as PlayerWithStatus;
    }

    public getAll(): PlayerWithStatus[] {
        return this.players.map(p => this.wrapPlayer(p));
    }

    public getPlayerFromAddress(address: string): PlayerWithStatus|null {
        const player = this.players.find(x => x.kromerAddress.toLowerCase() === address.toLowerCase());
        if (player) {
            return this.wrapPlayer(player);
        }
        return null;
    }

    public getPlayersFromAddresses(addresses: string[]): PlayerWithStatus[] {
        return addresses
            .map(x => this.getPlayerFromAddress(x))
            .filter(x => x !== null) as PlayerWithStatus[];
    }

    public getPlayerFromUUID(uuid: string): PlayerWithStatus|null {
        const player = this.players.find(x => x.minecraftUUID === uuid);
        if (player) {
            return this.wrapPlayer(player);
        }
        return null;
    }

    public getPlayersFromUUIDs(uuids: string[]): PlayerWithStatus[] {
        return uuids
            .map(x => this.getPlayerFromUUID(x))
            .filter(x => x !== null) as PlayerWithStatus[];
    }

    public getPlayerFromName(name: string): PlayerWithStatus|null {
        const player = this.players.find(x => x.minecraftName.toLowerCase() === name.toLowerCase());
        if (player) {
            return this.wrapPlayer(player);
        }
        return null;
    }

    public getPlayersFromNames(names: string[]): PlayerWithStatus[] {
        return names
            .map(x => this.getPlayerFromName(x))
            .filter(x => x !== null) as PlayerWithStatus[];
    }

    public getNotifiedPlayers(): PlayerWithStatus[] {
        return this.players
            .filter(x => x.notifications !== "none")
            .filter(x => rcc.players.find(p => p.uuid === x.minecraftUUID) !== undefined)
            .map(x => this.wrapPlayer(x));
    }
}

export default new PlayerManager();
