import { MatrixClient, PowerLevelsEventContent } from "matrix-bot-sdk";
import { getASClientFromEnv, getClientFromEnv } from "./helpers/util";
import { createInterface } from "readline";

const USER_REGEX = new RegExp(process.env.USER_REGEX);
const live = process.env.DRY === 'false';

const TIMESTAMP_CUTOFF = 1621508400000;
const MEMBER_CUTOFF = 5;

async function findPoweredMatrixUsers(bridgeClient: MatrixClient, roomId: string, powerLevelEvent: {content: PowerLevelsEventContent, origin_server_ts: number, unsigned: {replaces_state: string}}) {
    const users = Object.entries(powerLevelEvent.content.users).filter(([key, value]) => !USER_REGEX.test(key) && value >= 50);
    if (users.length > 0) {
        return users;
    }
    if (powerLevelEvent.origin_server_ts < TIMESTAMP_CUTOFF) {
        return null;
    }
    // Keep going
    const event = await bridgeClient.getEvent(roomId, powerLevelEvent.unsigned.replaces_state);
    return findPoweredMatrixUsers(bridgeClient, roomId, event);
}

async function handleRoom(bridgeClient: MatrixClient, roomIdOrAlias: string) {
    const myId = await bridgeClient.getUserId();
    const log = (type: "log"|"error"|"warn", ...args: any) => console[type](`${roomIdOrAlias}: `, ...args);
    // The only way to get an event id for a state event by name.
    const pls = await bridgeClient.getRoomState(roomIdOrAlias);
    if (pls.filter( e => (e.type === 'm.room.member')).length < MEMBER_CUTOFF) {
        log('log', "Too few members, not checking");
        return;
    }
    const powerLevelEvent = pls.find((e) => e.type === 'm.room.power_levels' && e.state_key === '');
    if (!powerLevelEvent) {
        log('error', "No power level event in room");
        return;
    }
    const users = await findPoweredMatrixUsers(bridgeClient, roomIdOrAlias, powerLevelEvent);
    if (users) {
        log('log', "Found users for room", users);
    } else {
        log('error', "Could not find any Matrix users for this room");
    }
}


async function main() {
    const rl = createInterface({
        input: process.stdin,
        terminal: false,
        crlfDelay: 500,
    });
    const bridgeClient = getClientFromEnv(true);
    for await (const roomId of rl) {
        try {
            await handleRoom(bridgeClient, roomId);
        } catch (ex) {
            console.error(`${roomId}: ERROR Failed to handle ${ex.message}`);
        }
    }
}

main().catch((ex) => {
    console.log("Failed to run command:", ex.toString());
    process.exit(1);
})