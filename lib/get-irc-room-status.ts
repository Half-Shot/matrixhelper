import Envs from "./helpers/env";
import { getClientFromEnv } from "./helpers/util";

async function main() {
    const roomId = Envs.get("MX_ROOM_ID");
    const client = await getClientFromEnv(false);
    const details = await client.getOpenIDConnectToken();
    const reqBody = {
        matrixServer: details.matrix_server_name,
        openIdToken: details.access_token,
    };
    const res = await fetch("https://libera.ems.host/ircbridge/_matrix/provision/v1/exchange_openid",
        {
            method: 'POST',
            body: JSON.stringify(reqBody),
            headers: {
                'Content-Type': 'application/json',
            },
        },
    );
    // TODO: Save auth token
    const { token } = await res.json();
    const listLinkRes = await fetch(`https://libera.ems.host/ircbridge/_matrix/provision/listlinks/${encodeURIComponent(roomId)}`,
        {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token,
            },
        },
    );
    console.log(await listLinkRes.text());
}


main().catch((ex) => {
    console.log("Failed to run command:", ex.toString());
})