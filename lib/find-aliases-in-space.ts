import { getClientFromEnv } from "./helpers/util";
import { LogLevel, LogService, Space, SpaceEntityMap } from "matrix-bot-sdk";
import { terminal } from "terminal-kit";
import { writeFile } from 'node:fs/promises';
import { createHash } from "node:crypto";
import { join } from "node:path";

LogService.setLevel(LogLevel.ERROR);


async function main() {
    const client = await getClientFromEnv(true);
    const spaceRoomIdOrAlias = process.argv[2];
    const rootRoomId = await client.resolveRoom(spaceRoomIdOrAlias);
    const cacheHash = createHash("md5").update(rootRoomId).digest().toString("hex");
    const cachePath = join(__dirname, '..', `.space-cache.${cacheHash}.json`);
    console.log(`Will write cached data to ${cachePath}`);
    const rootSpace: Space = await client.getSpace(rootRoomId);

    // All the rooms we found
    const rooms = new Map<string, {aliases?: string[]}>([[rootRoomId, {}]]);

    // Spaces to process
    const spaceStack: string[][] = [];
    let currentSpaceChildren: string[]|undefined = Object.keys(await rootSpace.getChildEntities());
    let i = 5;
    const pbar = terminal.progressBar({
        percent: true,
        titleSize: 50,
        title: 'Discovering root space',
    });
    let itemCount = 0;
    do {
        for (const roomId of currentSpaceChildren) {
            if (rooms.has(roomId)) {
                console.log(`Already encountered ${roomId}, skipping`);
                // Already encounterd this room, skipping.
                continue;
            }
            const roomState = await client.adminApis.synapse.getRoomState(roomId);
            const isSpace = roomState.find(a => a.type === "m.room.create").content.type === "m.space";
            if (isSpace) {
                // Child
                const children = roomState.filter(a => a.type === "m.space.child").map(a => a.state_key);
                spaceStack.push(children);
            } else {
                // Leaf
            }

            const canonicalAliasEvent = roomState.find(a => a.type === "m.room.canonical_alias");
            if (canonicalAliasEvent) {
                rooms.set(roomId, {
                    aliases: [canonicalAliasEvent.content.alias, ...(canonicalAliasEvent.content.alt_aliases || [])]
                });
            } else {
                console.warn(`${roomId} has no canoncial alias, skipping`)
            }
        }
        pbar.update({
            progress: itemCount++ / (itemCount + spaceStack.length),
            title: `Processing space ${itemCount}. ${spaceStack.length} spaces left to discover.`
        });
    } while (currentSpaceChildren = spaceStack.pop())
    pbar.stop();
    // Cache this to disk
    writeFile(cachePath, JSON.stringify([...rooms.entries()]), "utf-8");
    console.log(rooms);
}

main().catch((ex) => {
    console.log("Failed to run command:", ex);
    process.exit(1);
})