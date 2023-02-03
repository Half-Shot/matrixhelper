import Envs from "./helpers/env";
import { CanonicalAliasEventContent, LogLevel, LogService, MatrixClient } from "matrix-bot-sdk";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { getClientFromEnv } from "./helpers/util";
import { readFile } from 'node:fs/promises';
import { terminal } from "terminal-kit";

const live = !Envs.dry;

LogService.setLevel(LogLevel.ERROR);

async function archiveRoom(client: MatrixClient, roomId: string, newPrefix: string) {
    // First, fetch the aliases for the room.
    const { aliases } = await client.doRequest('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/aliases`) as { aliases: string[] };
    const aliasesToChange = aliases.filter( a => !a.startsWith('#' + newPrefix));
    const currentCanonicalState: CanonicalAliasEventContent = await client.getRoomStateEvent(roomId, 'm.room.canonical_alias', '');

    let newCanonicalAlias: string|undefined;

    if (aliasesToChange.length === 0) {
        // First lowercase one will do.
        newCanonicalAlias = aliases.find(a => a.toLowerCase() === a);
        console.log(`No aliases to change for ${roomId}`);
    }

    // Adjust the alias
    for (const alias of aliasesToChange) {
        const newAlias = `#${newPrefix}${alias.substring(1)}`;

        // Prefer lowercase
        if (alias.toLowerCase() === alias && !newCanonicalAlias) {
            newCanonicalAlias = newAlias;
        }

        // Sometimes the new one already exists
        if (!aliases.includes(newAlias)) {
            if (live) {
                await client.createRoomAlias(newAlias, roomId);
            } else {
                console.log(`DRY: Would have created alias ${newAlias} for ${roomId}`);
            }
        }

        if (live) {
            await client.deleteRoomAlias(alias);
        } else {
            console.log(`DRY: Would have deleted alias ${alias} for ${roomId}`);
        }
    }

    if (!newCanonicalAlias) {
        // Should not really happen
        throw Error("Cannot check canonical alias, didn't generate an alias in the previous step");
    }

    // Now check the canonical state.
    if (currentCanonicalState.alias !== newCanonicalAlias) {
        // No canonical alias (will happen if we delete an alias), set to the first one we have.
        if (live) {
            await client.sendStateEvent(roomId, 'm.room.canonical_alias', '', { alias: newCanonicalAlias });
        } else {
            console.log(`DRY: Would have changed canonical alias to ${newCanonicalAlias} for ${roomId}`);
        }
    } else {
        console.log(`No caonical aliases to change for ${roomId}`);
    }
}

/**
 * This command will "archive" all rooms given in the output of `find-aliases-in-space`.
 * 
 * You *must* run the `find-aliases-in-space` command first.
 * 
 * @example yarn find-aliases-in-space '#my-space:example.com' '2023_' 'not_this_prefix,orthis' 'onlythisprefix'
 */
async function main() {
    console.log("Running in", live ? "live" : "dry", "mode");
    const [, roomAlias, newPrefix] = process.argv;
    const client = await getClientFromEnv(false);
    const rootRoomId = await client.resolveRoom(roomAlias);
    const cacheHash = createHash("md5").update(rootRoomId).digest().toString("hex");
    const cachePath = join(__dirname, '..', `.space-cache.${cacheHash}.json`);

    const prefixesToSkip = process.argv.at(3)?.split(',');
    const prefixesToHandle = process.argv[4]?.split(',') || [];
    const prefixHandleRegex = new RegExp(`^(?:${prefixesToHandle.join("|")})`, 'i');
    const prefixSkipRegex = prefixesToSkip && new RegExp(`^(?:${prefixesToSkip.join("|")})`, 'i');

    // Get these rooms from find-aliases-in-room.ts
    const allRooms = new Map<string, {aliases?: string[]}>(
        JSON.parse(await readFile(cachePath, "utf-8"))
    );
    const roomsToHandle = new Map([...allRooms.entries()].filter(
        ([,data]) => data.aliases?.find(fullAlias => {
            const alias = fullAlias.substring(1);
            if (prefixSkipRegex?.test(alias)) {
                return false;
            }
            return prefixHandleRegex.test(alias);
        }
    )));
    console.log([...roomsToHandle.entries()].map(([roomId, data]) => `${roomId} => ${data.aliases?.join(',')}`).join('\n'));
    console.log("Matched", roomsToHandle.size, "of", allRooms.size, ".");
    if (roomsToHandle.size === 0) {
        return;
    }
    console.log('Do you want to continue?');
    // if (!await terminal.yesOrNo().promise) {
    //      return;
    // }
    terminal.grabInput(false);
    const progress = terminal.progressBar({ 
        percent: true,
        items: roomsToHandle.size,
    })
    console.log("Continuing");
    for (const roomId of roomsToHandle.keys()) {
        progress.startItem(roomId);
        await archiveRoom(client, roomId, newPrefix);
        progress.itemDone(roomId);
    }
    progress.stop();
}

main().catch((ex) => {
    console.log("Failed to run command:", ex);
    process.exit(1);
}) 