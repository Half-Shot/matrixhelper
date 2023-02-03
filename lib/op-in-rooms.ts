import { getClientFromEnv } from "./helpers/util";
import { createInterface } from 'readline';
import { LogLevel, LogService } from "matrix-bot-sdk";
import { PowerLevelAction } from "matrix-bot-sdk/lib/models/PowerLevelAction";
const live = process.env.DRY === 'false';

LogService.setLevel(LogLevel.ERROR);

async function main() {
    if (live) {
        console.log(`Doing a LIVE run`);
    } else {
        console.log(`Doing a dry run`);
    }
    const bridgeClient = await getClientFromEnv();
    const userId = process.argv[2];
    const rl = createInterface({
        input: process.stdin,
        terminal: false,
        crlfDelay: 500,
    });
    for await (const roomId of rl) {
        try {
            console.log(`Checking '${roomId}'`);
            if (await bridgeClient.userHasPowerLevelForAction(userId, roomId, PowerLevelAction.Kick)) {
                console.log("Power level not needed");
                continue;
            }
            console.log("Continuing to op");
            if (live) {
                await bridgeClient.setUserPowerLevel(userId, roomId, 50);
            }
        } catch (ex) {
            console.log(`Threw, skipping ${roomId}`, ex.message);
        }
    }
}

main().catch((ex) => {
    console.log("Failed to run command:", ex.toString());
    process.exit(1);
})