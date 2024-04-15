import { LogService, MatrixClient, PowerLevelsEventContent, RoomNameEventContent } from "matrix-bot-sdk";
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

    for await (const roomId of [...provisionRooms]) {
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
            await makeRoomLegacy(client, roomId, plcontent);
        }
        stats.completed++;
        // Do *one* room.
        return;
    }
}

async function makeRoomLegacy(client: MatrixClient, roomId: string, plcontent: PowerLevelsEventContent) {
    if (Envs.dry) {
        console.log('Would set PL in room to 100')
    } else {
        plcontent.events_default = 100;
        if (process.env.BRIDGE_MESSAGE) {
            await client.sendMessage(roomId, process.env.BRIDGE_MESSAGE);
        }
        const { name } = await client.getRoomStateEvent(roomId, "m.room.name", "") as RoomNameEventContent;
        await client.sendStateEvent(roomId, "m.room.name", "", { name: `[DISABLED] ${name}`});
        await client.sendStateEvent(roomId, "m.room.power_levels", "", plcontent);
    }
}

main().catch((ex) => {
    console.log("Failed to run command:", ex.toString());
})