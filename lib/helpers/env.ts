export default class Envs {
    static get homeserver() {
        const hs = this.get("MX_HOMESERVER");
        if (!hs.startsWith("http")) {
            return `https://${hs}`;
        }
        return hs;
    }

    static get(env: string) {
        const value = process.env[env];
        if (!value) {
            throw Error(`No ${env} defined in env`);
        }
        return value;
    }

    static get dry() {
        return process.env.DRY !== 'false';
    }
}