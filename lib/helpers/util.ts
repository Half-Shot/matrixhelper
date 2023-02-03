import { LogLevel, LogService, MatrixClient, MatrixError } from "matrix-bot-sdk";
import Envs from "./env";

LogService.setLevel(LogLevel.WARN);

export async function getClientFromEnv(needAdmin = false) {
    const token = process.env.MX_ACCESS_TOKEN || process.env.MX_APPSERVICE_TOKEN;
    if (!token) {
        throw Error('No MX_ACCESS_TOKEN or MX_APPSERVICE_TOKEN defined');
    }
    const client = new MatrixClient(Envs.homeserver, token);
    if (needAdmin) {
        if (!await client.adminApis.synapse.isAdmin(await client.getUserId())) {
            throw Error('Access token is not admin');
        }
    }
    await client.getWhoAmI();
    return client;
}

export function getASClientFromEnv(userId?: string) {
    if (!process.env.MX_APPSERVICE_TOKEN) {
        throw Error('No MX_APPSERVICE_TOKEN defined');
    }
    const client = new MatrixClient(Envs.homeserver, process.env.MX_APPSERVICE_TOKEN);
    if (userId) client.impersonateUserId(userId);
    return client;
}

export async function registerASUser(userId: string) {
    console.log(userId);
    if (!Envs.homeserver) {
        throw Error('No MX_HOMESERVER defined');
    }
    if (!process.env.MX_APPSERVICE_TOKEN) {
        throw Error('No MX_APPSERVICE_TOKEN defined');
    }
    const client = new MatrixClient(Envs.homeserver, process.env.MX_APPSERVICE_TOKEN);
    try {
        const result = await client.doRequest("POST", "/_matrix/client/r0/register", null, {
            type: "m.login.application_service",
            username: userId.substring(1).split(":")[0],
        });
    } catch (err) {
        if (err instanceof MatrixError) {
            if (err.errcode === "M_USER_IN_USE") {
                return;
            }
        }
        throw err;
    }
}