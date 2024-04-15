import { LogService, PowerLevelsEventContent } from "matrix-bot-sdk";
import { getClientFromEnv } from "./helpers/util";
import { createInterface } from "readline/promises";
import postgres from "postgres";
import Envs from "./helpers/env";

LogService.muteModule('MatrixHttpClient');

const sql = postgres({
    ssl: 'prefer'
})

async function main() {
    const client = await getClientFromEnv(false);
    const userId = await client.getUserId();
    const rl = createInterface({
        input: process.stdin,
        terminal: false,
        crlfDelay: 500,
    });

    let stats = { notInRoom: 0, noPowerLevel: 0, completed: 0};

    // DM rooms
    const dmRooms = (await sql`SELECT room_id from pm_rooms`).map((v) => v.room_id);
    const bridgeRooms = (await sql`SELECT room_id from rooms WHERE origin != 'provision'`).map((v) => v.room_id);
    const provisionRooms = (await sql`SELECT room_id from rooms WHERE origin = 'provision'`).map((v) => v.room_id);

    console.log(`Found ${dmRooms.length} DM rooms`);
    console.log(`Found ${bridgeRooms.length} portal rooms`);
    console.log(`Found ${provisionRooms.length} plumbed rooms`);

    for await (const roomId of [...dmRooms, ...bridgeRooms]) {
        let plcontent: PowerLevelsEventContent;
        try {
            plcontent = await client.getRoomStateEvent(roomId, "m.room.power_levels", "");
        } catch (ex) {
            console.warn(`Not in ${roomId}, unable to modify room`);
            stats.notInRoom++;
            continue;
        }
        const roomPL = plcontent.users?.[userId];
        if (roomPL !== 100) {
            console.warn(`Not an admin in ${roomId}, only PL${roomPL}`);
            stats.noPowerLevel++;
            continue;
        }
        if (plcontent.events_default !== 100) {
            if (Envs.dry) {
                console.log('Would set PL in room to 100')
            } else {
                plcontent.events_default = 100;
                if (process.env.BRIDGE_MESSAGE) {
                    await client.sendMessage(roomId, process.env.BRIDGE_MESSAGE);
                }
                await client.sendStateEvent(roomId, "m.room.power_levels", "", plcontent);
            }
        }
        stats.completed++;
    }
    Object.entries(stats).forEach(([stat, value]) => console.log(`${stat}: ${value}`));
}

// async function makeRoomLegacy(client: MatrixClient, roomId: string, name: string, alias: string) {
//     const userId = await client.getUserId();
//     // First, join the room.
//     await client.joinRoom(roomId);
//     // Now check the PLs
//     const plcontent = await client.getRoomStateEvent(roomId, "m.room.power_levels", "");
//     if (plcontent.users[userId] !== 100) {
//         process.stdout.write("Applying admin permissions...");
//         const members = await client.getJoinedRoomMembers(roomId);
//         const adminUserID = Object.entries(plcontent.users).find(([userId, power]) => power === 100 && members.includes(userId))[0];
//         const adminClient = getASClientFromEnv(adminUserID);
//         await adminClient.sendStateEvent(roomId, "m.room.power_levels", "", {
//             ...plcontent,
//             users: {
//                 ...plcontent.users,
//                 [userId]: 100,
//             }
//         });
//         // First, get admin in the room.
//         console.log("DONE");
//     }
//     try {
//         process.stdout.write("Deleting alias...");
//         // Then remove the alias
//         await client.deleteRoomAlias(alias);
//         console.log("DONE");
//     } catch (ex) {
//         if (ex.body.errcode === 'M_NOT_FOUND') {
//             console.warn(`IGNORE No alias found. ignoring`);
//         }
//     }
//     process.stdout.write("Set directory visiblity...");
//     await client.setDirectoryVisibility(roomId, "private");
//     console.log("DONE");
//     if (!name.startsWith("[OBSOLETE]")) {
//         process.stdout.write("Changing room name");
//         // Then, set the room name to something else
//         await client.sendStateEvent(roomId, "m.room.name", "", {name: `[OBSOLETE] ${name}`});
//         console.log("DONE");
//         process.stdout.write("Sending notice...");
//         await client.sendText(roomId, "This room is being rebridged. Please check the room directory soon for the new room");
//         console.log("DONE");
//     }
// }

main().catch((ex) => {
    console.log("Failed to run command:", ex.toString());
})