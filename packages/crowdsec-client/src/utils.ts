import { RawAxiosRequestConfig } from 'axios';
import createDebug, { Debugger } from 'debug';
import url, { URL, URLSearchParams } from 'node:url';
import { pkg } from './pkg.js';

const debug = createDebug(pkg.name);

/**
 * create a debugger extending the default debugger
 * @param name - name for the debugger
 */
export const createDebugger = (name: string): Debugger => {
    if (!name) {
        throw new Error('name is mandatory');
    }
    return debug.extend(name);
};

/**
 * used to log an url
 * @param req - the RawAxiosRequestConfig object from axios
 * @param hidePassword - to hide "auth" part of the url
 */
export const getUrlRepresentation = (req: RawAxiosRequestConfig, hidePassword = true): string => {
    const urlParsed = new URL((req.baseURL || 'http://localhost') + (req.url ?? ''));
    const params = new URLSearchParams(urlParsed.search);

    if (req.auth) {
        if (!urlParsed.username) {
            urlParsed.username = req.auth.username;
        }
        if (!urlParsed.password) {
            urlParsed.password = req.auth.password;
        }
    }

    if (req.params) {
        Object.entries(req.params as Record<string, string>).forEach(([k, v]) => {
            if (v === undefined || v === null) {
                return;
            }
            params.append(k, v);
        });
    }

    urlParsed.search = params.toString();
    // @ts-ignore
    return url.format(urlParsed, {
        auth: !hidePassword
    });
};

export const parseExpiration = (duration: string) => {
    const durationRe = /(?<multiplier>[-+]?)(?:(?<hours>\d{1,8})h)?(?:(?<minutes>\d{1,2})m)?(?:(?<seconds>\d{1,2}\.\d+)s)?/gm.exec(
        duration
    );

    if (!durationRe?.groups || !durationRe?.[0]) {
        throw new Error(`fail to parse duration "${duration}"`);
    }

    const multiplier = durationRe.groups.multiplier === '-' ? -1 : 1;
    const hours = parseInt(durationRe.groups.hours);
    const minutes = parseInt(durationRe.groups.minutes);
    let seconds = (parseFloat(durationRe.groups.seconds) || 0) * 1000;

    if (hours && !isNaN(hours)) {
        seconds += hours * 60 * 60 * 1000;
    }
    if (minutes && !isNaN(minutes)) {
        seconds += minutes * 60 * 1000;
    }

    return new Date(Date.now() + seconds * multiplier);
};

export const forceArray = <T>(p: Readonly<T | Array<T>>): Array<T> => (Array.isArray(p) ? p : [p]);
