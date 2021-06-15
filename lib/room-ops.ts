import { MatrixClient, PowerLevelsEventContent } from "matrix-bot-sdk";
import { getASClientFromEnv, getClientFromEnv } from "./helpers/util";
import { createInterface } from "readline";
import { promises as fs } from "fs";

const USER_REGEX = new RegExp(process.env.USER_REGEX);
const live = process.env.DRY === 'false';

const TIMESTAMP_CUTOFF = 1621508400000;
const MEMBER_CUTOFF = 5;

async function findPoweredMatrixUsers(bridgeClient: MatrixClient, roomId: string, powerLevelEvent: {content: PowerLevelsEventContent, origin_server_ts: number, unsigned: {replaces_state: string}}) {
    const users = Object.entries(powerLevelEvent.content.users).filter(([key, value]) => !USER_REGEX.test(key) && value >= 50);
    if (users.length > 0) {
        return [users, powerLevelEvent.origin_server_ts];
    }
    if (powerLevelEvent.origin_server_ts < TIMESTAMP_CUTOFF) {
        console.log(`Cutting off at ${new Date(powerLevelEvent.origin_server_ts).toISOString()}`);
        return null;
    }
    // Keep going
    console.log(`No users found, recursing into ${powerLevelEvent.unsigned.replaces_state}`);
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
        return {users: users[0], setAt: users[1]};
    } else {
        log('error', "Could not find any Matrix users for this room");
        return {users: null};
    }
    // Delay to avoid killing the server
    await new Promise(r => setTimeout(r, 250));
}

async function main() {
    const rl = createInterface({
        input: process.stdin,
        terminal: false,
        crlfDelay: 500,
    });
    const bridgeClient = getClientFromEnv(true);
    const stream = await fs.open('room-ops.json', "w");
    stream.write('[\n');
    for await (const input of rl) {
        const keys = input.split('|');
        const roomId = keys[0].trim();
        const ircChannel = keys[1].trim();
        try {
            // For psql style output.
            const result = await handleRoom(bridgeClient, roomId);
            await stream.write(`  ${JSON.stringify({...result, roomId, ircChannel}, undefined, 0)}\n`);
        } catch (ex) {
            console.error(`${roomId}: ERROR Failed to handle ${ex.message}`);
            await stream.write(`  ${JSON.stringify({roomId, ircChannel, users: null, failed: true}, undefined, 0)}\n`);
        }
    }
    stream.write(']\n');
    stream.close();
}

main().catch((ex) => {
    console.log("Failed to run command:", ex.toString());
    process.exit(1);
})