import { getASClientFromEnv } from "./helpers/util";

async function main() {
    const roomId = process.env.MX_ROOM_ID;
    const client = getASClientFromEnv();
    await client.setUserPowerLevel(process.env.USER_TO_POWER, roomId, parseInt(process.env.USER_POWER));
}


main().catch((ex) => {
    console.log("Failed to run command:", ex.toString());
})