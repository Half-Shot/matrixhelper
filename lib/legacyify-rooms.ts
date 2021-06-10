import { MatrixClient } from "matrix-bot-sdk";
import { getASClientFromEnv, getClientFromEnv } from "./helpers/util";

interface RoomsResults {
    rooms: {
        room_id: string;
        name: string|null;
        canonical_alias: string|null;
        joined_members: number;
        joined_local_members: number;
        version: number;
        creator: string;
        encryption: string|null;
        federatable: boolean;
        public: boolean;
        join_rules: string;
        guest_access: 'can_join';
        history_visibility: 'shared';
        state_events: number;
    }[]
    total_rooms: number;
}

async function main() {
    const client = getClientFromEnv(true);
    const result = await client.doRequest("GET", "/_synapse/admin/v1/rooms", { from: 9, limit: 1000}) as RoomsResults;
    console.log(result.total_rooms);
    const rooms = result.rooms.filter((r) => {
        return r.public && r.canonical_alias && r.canonical_alias.startsWith("#");
    });
    let i = 0;
    // Get an AS client to avoid rate limits
    const roomClient = getASClientFromEnv(await client.getUserId());
    for (const room of rooms) {
        await new Promise(r => setTimeout(r, 2000));
        console.group(`Applying legacy to ${room.room_id} ${room.canonical_alias} ${i}`);
        await makeRoomLegacy(roomClient, room.room_id, room.name, room.canonical_alias);
        console.groupEnd();
        i++;
    }
}

async function makeRoomLegacy(client: MatrixClient, roomId: string, name: string, alias: string) {
    const userId = await client.getUserId();
    // First, join the room.
    await client.joinRoom(roomId);
    // Now check the PLs
    const plcontent = await client.getRoomStateEvent(roomId, "m.room.power_levels", "");
    if (plcontent.users[userId] !== 100) {
        process.stdout.write("Applying admin permissions...");
        const members = await client.getJoinedRoomMembers(roomId);
        const adminUserID = Object.entries(plcontent.users).find(([userId, power]) => power === 100 && members.includes(userId))[0];
        const adminClient = getASClientFromEnv(adminUserID);
        await adminClient.sendStateEvent(roomId, "m.room.power_levels", "", {
            ...plcontent,
            users: {
                ...plcontent.users,
                [userId]: 100,
            }
        });
        // First, get admin in the room.
        console.log("DONE");
    }
    try {
        process.stdout.write("Deleting alias...");
        // Then remove the alias
        await client.deleteRoomAlias(alias);
        console.log("DONE");
    } catch (ex) {
        if (ex.body.errcode === 'M_NOT_FOUND') {
            console.warn(`IGNORE No alias found. ignoring`);
        }
    }
    process.stdout.write("Set directory visiblity...");
    await client.setDirectoryVisibility(roomId, "private");
    console.log("DONE");
    if (!name.startsWith("[OBSOLETE]")) {
        process.stdout.write("Changing room name");
        // Then, set the room name to something else
        await client.sendStateEvent(roomId, "m.room.name", "", {name: `[OBSOLETE] ${name}`});
        console.log("DONE");
        process.stdout.write("Sending notice...");
        await client.sendText(roomId, "This room is being rebridged. Please check the room directory soon for the new room");
        console.log("DONE");
    }
}

main().catch((ex) => {
    console.log("Failed to run command:", ex.toString());
})