import { LogLevel, LogService, MatrixClient } from "matrix-bot-sdk";

LogService.setLevel(LogLevel.WARN);

export function getClientFromEnv(needAdmin = false) {
    if (!process.env.MX_HOMESERVER) {
        throw Error('No MX_HOMESERVER defined');
    }
    const token = process.env.MX_ACCESS_TOKEN || process.env.MX_APPSERVICE_TOKEN;
    if (!token) {
        throw Error('No MX_ACCESS_TOKEN or MX_APPSERVICE_TOKEN defined');
    }
    const client = new MatrixClient(process.env.MX_HOMESERVER, token);
    if (needAdmin) {
        // XXX: Requires https://github.com/turt2live/matrix-bot-sdk/pull/98/files 
        // if (!await client.adminApis.synapse.isAdmin(await client.getUserId())) {
        //     throw Error('Access token is not admin');
        // }
    }
    return client;
}

export function getASClientFromEnv(userId?: string) {
    if (!process.env.MX_HOMESERVER) {
        throw Error('No MX_HOMESERVER defined');
    }
    if (!process.env.MX_APPSERVICE_TOKEN) {
        throw Error('No MX_APPSERVICE_TOKEN defined');
    }
    const client = new MatrixClient(process.env.MX_HOMESERVER, process.env.MX_APPSERVICE_TOKEN);
    
    if (userId) client.impersonateUserId(userId);
    return client;
}

export async function registerASUser(userId: string) {
    console.log(userId);
    if (!process.env.MX_HOMESERVER) {
        throw Error('No MX_HOMESERVER defined');
    }
    if (!process.env.MX_APPSERVICE_TOKEN) {
        throw Error('No MX_APPSERVICE_TOKEN defined');
    }
    const client = new MatrixClient(process.env.MX_HOMESERVER, process.env.MX_APPSERVICE_TOKEN);
    try {
        const result = await client.doRequest("POST", "/_matrix/client/r0/register", null, {
            type: "m.login.application_service",
            username: userId.substring(1).split(":")[0],
        });
    } catch (err) {
        if (typeof (err.body) === "string") err.body = JSON.parse(err.body);
        if (err.body && err.body["errcode"] === "M_USER_IN_USE") {
            return;
        }
        throw err;
    }
}