import { getClientFromEnv } from "./helpers/util";

async function main() {
    const roomId = process.env.MX_ROOM_ID;
    const userId = process.env.USER_ID;
    const dropPls = process.env.DROP_PLS === 'true';
    const client = getClientFromEnv();
    const isJoined = (await client.getJoinedRooms()).includes(roomId);
    if (!isJoined) {
        console.log("User is not joined");
        return;
    }
    if (dropPls) {
        try {
            await client.setUserPowerLevel(userId, roomId, 0);
        } catch (ex) {
            console.log("Failed to drop PLs:", ex);
        }
    }
    await client.leaveRoom(roomId);
}


main().catch((ex) => {
    console.log("Failed to run command:", ex.toString());
})