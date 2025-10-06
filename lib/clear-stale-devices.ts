import { getClientFromEnv, getVictoriaMetricAvgValue } from "./helpers/util";
import Envs from "./helpers/env";
import { Cache } from "./helpers/cache";

// 90 days
const days = Envs.getWithType(s => {
    const i = parseInt(s);
    if (Number.isInteger(i)) {
        return i;
    }
    throw Error('Invalid number ' + s)
}, "MAX_LAST_SEEN_DAYS", "90");

const maximumDeviceLastSeen = Date.now() - (days*24*60*60*1000);

interface DeviceListResponse {
    devices: {
        user_id: string,
        device_id: string,
        display_name:string,
        last_seen_user_agent: string,
        last_seen_ts: number,
        last_seen_ip: string
    }[]
}

/**
 * Deletes devices from all users on a homeserver which have not been used over a certain date.
 * 
 * Envs:
 *  - `MAX_LAST_SEEN_DAYS` The number of days a device may be unused before it is deleted, defaults to 90.
 */
async function main() {
    const client = await getClientFromEnv(true);
    const { user_id: myUserId } = await client.getWhoAmI();
    const cache = new Cache<{user_id: string, device_id: string, last_seen_ts: number}>(Envs.homeserver+'_'+days);
    const staleDeviceSet = await cache.read();
    if (staleDeviceSet.length === 0) {
        console.log('Cache empty, reading devices from Synapse');
        for await (const user of client.adminApis.synapse.listAllUsers({ deactivated: false, guests: false, limit: 100 })) {
            if (user.name === myUserId) {
                continue;
            }
            const deviceList = await client.doRequest('GET', `/_synapse/admin/v2/users/${encodeURIComponent(user.name)}/devices`) as DeviceListResponse;
            staleDeviceSet.push(...deviceList.devices.filter(device => !!device.last_seen_ts && device.last_seen_ts < maximumDeviceLastSeen).map(device => ({ user_id: device.user_id, device_id: device.device_id, last_seen_ts: device.last_seen_ts})));
        }
        staleDeviceSet.sort((a,b) => a.last_seen_ts-b.last_seen_ts);
        await cache.writeNewCache(staleDeviceSet);
    }

    if (Envs.dry) {
        console.log(`Would delete`, staleDeviceSet.length, 'devices');
        return;
    }

    let count = 0;
    const maxSize = staleDeviceSet.length;

    const metricsStatus = async (): Promise<number> => {
        if (Envs.prometheusUrl) {
            return getVictoriaMetricAvgValue(`sum(rate(synapse_storage_transaction_time_sum_total{${Envs.prometheusFilter}}[1m])))`);
        }
        return 0;
    }

    const waitFn = async () => {
        do {
            console.warn('VM state is above 600%, waiting 15s')
            await new Promise(r => setTimeout(r, 15000));
        } while (await metricsStatus() > 6)
    }
    let waitMetricsLoop: Promise<void> = (await metricsStatus() > 6) ? waitFn() : Promise.resolve();
    const workFn = async () => {
        do {
            await waitMetricsLoop;
            if (await metricsStatus() > 6) {
                waitMetricsLoop = waitFn();
                await waitMetricsLoop;
            }
            const [device] = staleDeviceSet.splice(0, 1);
            console.log(`Deleting ${device.user_id}/${device.device_id} ls: ${new Date(device.last_seen_ts)} (${count++}/${maxSize})`);
            try {
                await client.doRequest('DELETE', `/_synapse/admin/v2/users/${encodeURIComponent(device.user_id)}/devices/${device.device_id}`) as DeviceListResponse;
            } catch (ex) {
                console.error("Encountered error during processing, retrying in 1 minute", ex);
                await new Promise(r => setTimeout(r, 60000));
            } finally {
                cache.removeFromCache(device);
            }
            
        } while(staleDeviceSet.length)
    };
    await Promise.all([workFn(), workFn(), workFn(), workFn(), workFn(), workFn(), workFn(), workFn()]);

}

main().catch((ex) => {
    console.log("Failed to run command:", ex.toString());
    process.exit(1);
})