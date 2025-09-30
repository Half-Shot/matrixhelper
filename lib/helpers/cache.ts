import { createHash } from "node:crypto";
import { join } from "node:path"
import Envs from "./env";
import { readFile, writeFile } from "node:fs/promises";

/**
 * Exposes a simple file-based cache to store data to be used during processing.
 */
export class Cache<T> {
    public cachePath: string;
    public cacheItems: Set<T> =  new Set();
    constructor(key = Envs.homeserver, cmd = process.argv[process.argv.length-1], ) {
        const cacheHash = createHash("md5").update(cmd+key).digest().toString("hex");
        this.cachePath = join(__dirname,'../..', `.cache.${cacheHash}.json`);
    }


    public async read(): Promise<Array<T>> {
        try {
            this.cacheItems = new Set(JSON.parse(await readFile(this.cachePath, "utf-8")));
            return [...this.cacheItems];
        } catch (ex) {
            // TODO: Check error code.
            return [];
        }
    }
    
    public async removeFromCache(item: T) {
        this.cacheItems.delete(item);
        await this.write();
    }

    public async writeNewCache(items: Iterable<T>) {
        this.cacheItems.clear();
        for (const item of items) {
            this.cacheItems.add(item);
        }
        await this.write();
    }

    public async write(): Promise<void> {
        await writeFile(this.cachePath, JSON.stringify([...this.cacheItems]));
    }
}