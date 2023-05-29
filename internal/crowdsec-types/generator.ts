import { generateApi } from 'swagger-typescript-api';
import * as path from 'path';
// @ts-ignore
import prettier from '../../.prettierrc.js';

const CROWDSEC_SWAGGER_URL = 'https://raw.githubusercontent.com/crowdsecurity/crowdsec/master/pkg/models/localapi_swagger.yaml';

const main = async () => {
    await generateApi({
        name: 'crowdsec-api-generated.ts',
        output: path.join(__dirname, './@types/crowdsec/generated'),
        httpClientType: 'axios',
        url: CROWDSEC_SWAGGER_URL,
        generateClient: false,
        modular: true,
        prettier,
        cleanOutput: true,
        extractRequestParams: true,
        extractRequestBody: true,
        generateRouteTypes: true
    });
};

main().catch((e) => console.error(e));
