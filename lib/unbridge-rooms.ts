import { MatrixClient } from "matrix-bot-sdk";
import { getASClientFromEnv, getClientFromEnv } from "./helpers/util";
import { createInterface } from "readline";

const USER_REGEX = new RegExp(process.env.USER_REGEX);
const live = process.env.DRY === 'false';

async function main() {
    if (live) {
        console.log(`Doing a LIVE run`);
    } else {
        console.log(`Doing a dry run`);
    }
    const rl = createInterface({
        input: process.stdin,
        terminal: false,
        crlfDelay: 500,
    });
    const bridgeClient = getClientFromEnv(true);
    for await (const alias of rl) {
        try {
            await handleRoom(bridgeClient, alias);
        } catch (ex) {
            console.error(`${alias}: ERROR Failed to handle ${ex.message}`);
        }
    }
    // Also handle any rooms the bot is still in
    // const roomsTheBotIsIn = await bridgeClient.getJoinedRooms();
    // for (const roomId of roomsTheBotIsIn) {
    //     if ((await bridgeClient.getJoinedRoomMembers(roomId)).length <= 4) {
    //         console.log(`Skipping ${roomId} as it has less than two users`);
    //         continue;
    //     }
    //     try {
    //         await handleRoom(bridgeClient, roomId);
    //     } catch (ex) {
    //         console.error(`${roomId}: ERRO Failed to handle`, ex);
    //     }
    // }
}

async function handleRoom(bridgeClient: MatrixClient, roomIdOrAlias: string) {
    const myId = await bridgeClient.getUserId();
    const log = (type: "log"|"error"|"warn", ...args: any) => console[type](`${roomIdOrAlias}: `,...args);
    // First, resolve the alias
    const roomId: string = await bridgeClient.resolveRoom(roomIdOrAlias);

    // try {
    //     live ? await bridgeClient.setDirectoryVisibility(roomId, "private") : log("log", "would have set visibility");
    //     log("log", "Set visibility to private");
    // } catch (ex) {
    //     log("warn", "Could not set visibility", ex.message);
    // }

    // if (roomIdOrAlias.startsWith("#")) {
    //     try {
    //         live ? await bridgeClient.deleteRoomAlias(roomIdOrAlias) : log("log", "would have removed the alias");
    //         log("log", `Set removed alias from ${roomId}`)
    //     } catch (ex) {
    //         log("error", "Could not remove alias", ex.message);
    //     }
    // }

    // Drop PLs
    const canDropPls = await bridgeClient.userHasPowerLevelFor(myId, roomId, "m.room.power_levels", true);
    if (canDropPls) {
        const pls = await bridgeClient.getRoomStateEvent(roomId, "m.room.power_levels", "");
        for (const user of Object.keys(pls.users)) {
            if (user.match(USER_REGEX) || user === myId) {
                delete pls.users[user];
            }
        }
        if (pls.users.length > 0) {
            log("log", `Set powerlevels`);
            live ? await bridgeClient.sendStateEvent(roomId, "m.room.power_levels", "", pls) : log("log", "would changed the PLs to", pls);
        } else {
            log("log", "Not setting PLs, room would have no powered users");
        }
    } else {
        log("warn", "Bot doesn't have the powerlevel to drop PLs here");
    }

    // Drop users in the room
    try {
        const members = (await bridgeClient.getJoinedRoomMembers(roomId)).filter(r => r.match(USER_REGEX));
        console.log(`Got ${members.length} members`, members);
        for (const bridgeMember of members) {
            try {
                log("log", `Leaving ${bridgeMember}`);
                if (live) {
                    (await getASClientFromEnv(bridgeMember)).leaveRoom(roomId);
                }
            } catch (ex) {
                log("warn", `Failed to leave ${bridgeMember}`, ex.message);
            }
        }
    } catch (ex) {
        log("warn", "Failed to fetch members", ex.message);
    }

    if (live) {
        await bridgeClient.leaveRoom(roomId);
    }
}

main().catch((ex) => {
    console.log("Failed to run command:", ex.toString());
    process.exit(1);
})