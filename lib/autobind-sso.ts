import Envs from "./helpers/env";
import { getClientFromEnv } from "./helpers/util";
const authProvider = Envs.get('AUTH_PROVIDER');

if (Envs.dry) {
    console.log('Running in dry mode');
} else {
    console.log('Running in LIVE mode');
}

async function main() {
    const client = await getClientFromEnv(true);
    for await (const user of client.adminApis.synapse.listAllUsers()) {
        const userDetails: any = await client.adminApis.synapse.getUser(user.name);
        if (userDetails.external_ids?.length > 0) {
            console.warn(`User ${userDetails.name} already has an external ID bound`);
            continue;
        }
        const email = userDetails.threepids?.find((m: any) => m.medium === 'email')?.address;
        const externalIds = email && [ { authProvider: 'saml', external_id: email } ]
        if (!externalIds) {
            console.warn(`No email bound for ${userDetails.name}`);
            continue;
        }
        if (!Envs.dry) {
            await client.adminApis.synapse.upsertUser(userDetails.name, {
                external_ids: externalIds,
            } as any);
        } else {
            console.log(`Would apply to ${userDetails.name}:`, JSON.stringify(externalIds));
        }
    } 
}


main().catch((ex) => {
    console.log("Failed to run command:", ex.toString());
})