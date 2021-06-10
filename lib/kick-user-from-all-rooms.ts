import { getClientFromEnv } from "./helpers/util";
import { createInterface } from 'readline';
import { LogLevel, LogService } from "matrix-bot-sdk";
const live = process.env.DRY === 'false';

LogService.setLevel(LogLevel.ERROR);

async function main() {
    if (live) {
        console.log(`Doing a LIVE run`);
    } else {
        console.log(`Doing a dry run`);
    }
    const bridgeClient = getClientFromEnv(true);
    const userId = process.argv[2];
    const rl = createInterface({
        input: process.stdin,
        terminal: false,
        crlfDelay: 500,
    });
    for await (const roomId of rl) {
        try {
            console.log(`Checking '${roomId}', '${userId}'`);
            const isUserInRoom = await bridgeClient.getRoomStateEvent(roomId, 'm.room.member', userId);
            if (isUserInRoom && isUserInRoom.membership === "join") {
                console.log(`Found, kicking`);
                if (live) {
                    await bridgeClient.kickUser(userId, roomId, process.env.KICK_REASON || undefined);
                }
            }
        } catch (ex) {
            if (ex.body.errcode === 'M_NOT_FOUND') {
                continue;
            }
            console.log("Threw, skipping");
        }
    }
}

main().catch((ex) => {
    console.log("Failed to run command:", ex.toString());
    process.exit(1);
})