import { getASClientFromEnv, getClientFromEnv } from "./helpers/util";

async function main() {
    const roomId = process.env.MX_ROOM_ID;
    const via = process.env.MX_ROOM_VIA || roomId.split(':')[1];
    const power = parseInt(process.env.USER_POWER);
    if (Number.isNaN(power) || power < 0 || !Number.isSafeInteger(power)) {
        throw Error('Number was not a positive integer, rejecting');
    }
    const client = getClientFromEnv();
    const isJoined = (await client.getJoinedRooms()).includes(roomId);
    if (!isJoined) {
        await client.joinRoom(roomId, via.split(","));
    }
    await client.setUserPowerLevel(process.env.USER_TO_POWER, roomId, power);
    if (!isJoined) {
        await client.leaveRoom(roomId);
    }
}


main().catch((ex) => {
    console.log("Failed to run command:", ex.toString());
})