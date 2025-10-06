export default class Envs {
    static get homeserver() {
        const hs = this.get("MX_HOMESERVER");
        if (!hs.startsWith("http")) {
            return `https://${hs}`;
        }
        return hs;
    }

    static get prometheusUrl() {
        const value = this.get("VICTORIA_METRICS_URL");
        if (!value.startsWith("http")) {
            return `https://${value}`;
        }
        return value;
    }


    static get prometheusFilter() {
        const value = this.get("VICTORIA_METRICS_FILTER");
        if (!value.startsWith("http")) {
            return `https://${value}`;
        }
        return value;
    }

    static get(env: string) {
        const value = process.env[env];
        if (!value) {
            throw Error(`No ${env} defined in env`);
        }
        return value;
    }

    static getWithDefault(env: string, def: string) {
        const value = process.env[env];
        return value ?? def;
    }

    static getWithType<T>(typeFn: (t: string) => T, env: string, def: string) {
        const value = process.env[env];
        return typeFn(value ?? def);
    }

    static get dry() {
        return process.env.DRY !== 'false';
    }
}