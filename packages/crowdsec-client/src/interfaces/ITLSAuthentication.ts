export interface ITLSAuthentication {
    cert: Buffer | string;
    key: Buffer | string;
    ca: Buffer | string;
}
