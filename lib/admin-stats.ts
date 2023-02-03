import { getClientFromEnv } from "./helpers/util";
import { createInterface } from 'readline';
import { LogLevel, LogService } from "matrix-bot-sdk";
import { PowerLevelAction } from "matrix-bot-sdk/lib/models/PowerLevelAction";

LogService.setLevel(LogLevel.ERROR);

async function main() {
    const bridgeClient = await getClientFromEnv();
    const userId = process.argv[2] || await bridgeClient.getUserId();
    const rl = createInterface({
        input: process.stdin,
        terminal: false,
        crlfDelay: 500,
    });
    
    for await (const roomId of rl) {
        try {
            const hasPower = await bridgeClient.userHasPowerLevelForAction(userId, roomId, PowerLevelAction.Kick);
            console.log(`${roomId} ${hasPower ? "has" : "does not have"} PL in room`);
        } catch (ex) {
            console.log(`Threw, skipping ${roomId}`, ex.message);
        }
    }
}

main().catch((ex) => {
    console.log("Failed to run command:", ex.toString());
    process.exit(1);
})