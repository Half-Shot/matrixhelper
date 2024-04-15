import { LogService } from "matrix-bot-sdk";
import { getASClientFromEnv, getClientFromEnv } from "./helpers/util";
import { createInterface } from "readline/promises";
import postgres from "postgres";
import Envs from "./helpers/env";

LogService.muteModule('MatrixHttpClient');

const sql = postgres({
    ssl: 'prefer'
})

async function main() {
    const client = await getClientFromEnv(false);
    const rl = createInterface({
        input: process.stdin,
        terminal: false,
        crlfDelay: 500,
    });

    // DM rooms
    const dmRooms = (await sql`SELECT room_id from pm_rooms`).map((v) => v.room_id);
    const provisionRooms = (await sql`SELECT room_id from rooms WHERE origin = 'provision'`).map((v) => v.room_id);

    console.log(`Found ${dmRooms.length} DM rooms`);
    console.log(`Found ${provisionRooms.length} plumbed rooms`);

    for await (const roomId of [...dmRooms]) {
        const user = (await client.getJoinedRoomMembers(roomId)).find(user => user.startsWith('@_w3c_') && user.endsWith(':matrix.org'));
        const asClient = getASClientFromEnv(user);    
        try {
            if (process.env.BRIDGE_MESSAGE) {
                await asClient.sendNotice(roomId, process.env.BRIDGE_MESSAGE);
            }
        } catch (ex) {
            console.warn(`Failed to handle DM room ${roomId}`,  ex);
        }
    }
    for await (const roomId of [...provisionRooms]) {
        try {
            if (process.env.BRIDGE_MESSAGE) {
                await client.sendNotice(roomId, process.env.BRIDGE_MESSAGE);
            }
        } catch (ex) {
            console.warn(`Failed to handle provisioned room ${roomId}`,  ex);
        }
    }
    console.log('All done!');
}

main().catch((ex) => {
    console.log("Failed to run command:", ex.toString());
})