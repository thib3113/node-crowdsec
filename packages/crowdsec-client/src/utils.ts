import { RawAxiosRequestConfig } from 'axios';
import createDebug, { Debugger } from 'debug';
import url, { URL, URLSearchParams } from 'url';
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
    const urlParsed = new URL((req.baseURL || 'http://localhost') + (req.url || ''));
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
    const re = /(-?)(?:(?:(\d+)h)?(\d+)m)?(\d+).\d+(m?)s/m;
    const matches = duration.match(re);
    if (!matches?.length) {
        throw new Error(`Unable to parse the following duration: ${duration}.`);
    }
    let seconds = 0;
    if (matches[2] !== undefined) {
        seconds += parseInt(matches[2]) * 3600; // hours
    }
    if (matches[3] !== undefined) {
        seconds += parseInt(matches[3]) * 60; // minutes
    }
    if (matches[4] !== undefined) {
        seconds += parseInt(matches[4]); // seconds
    }
    if ('m' === matches[5]) {
        // units in milliseconds
        seconds *= 0.001;
    }
    if ('-' === matches[1]) {
        // negative
        seconds *= -1;
    }
    seconds = Math.round(seconds);
    const expiration = new Date();
    expiration.setSeconds(expiration.getSeconds() + seconds);
    return expiration;
};

export const forceArray = <T>(p: T | Array<T>): Array<T> => (Array.isArray(p) ? p : [p]);
