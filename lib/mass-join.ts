import { getASClientFromEnv, registerASUser } from "./helpers/util";

async function main() {
    const roomId = process.env.MX_ROOM_ID;
    const count = parseInt(process.env.MX_USER_COUNT);
    let members = [];
    // Get an AS client to avoid rate limits
    for (let index = 0; index < count; index++) {
        const userId = `@testuser_${index}:beefy`;
        if (members.includes(userId)) {
            continue;
        }
        await registerASUser(userId);
        const client = getASClientFromEnv(userId);
        if (index === 0) {
            members = await client.getJoinedRoomMembers(roomId);
        }
        await client.joinRoom(roomId);
        //await client.sendText(roomId, "Hello");
    }
}


main().catch((ex) => {
    console.log("Failed to run command:", ex.toString());
})