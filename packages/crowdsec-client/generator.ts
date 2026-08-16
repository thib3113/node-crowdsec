import { generateApi } from 'swagger-typescript-api';
import * as path from 'path';
// @ts-ignore
import prettierConfig from '../../.prettierrc.js';
import { fileURLToPath } from 'url';
import * as prettier from 'prettier';
import { readdir, readFile, writeFile } from 'node:fs/promises';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const CROWDSEC_SWAGGER_URL = 'https://raw.githubusercontent.com/crowdsecurity/crowdsec/master/pkg/models/localapi_swagger.yaml';

const formatGeneratedFiles = async () => {
    const generatedDir = path.join(__dirname, './src/types/generated');
    const files = (await readdir(generatedDir)).filter((file) => file.endsWith('.ts'));
    for (const file of files) {
        const filePath = path.join(generatedDir, file);
        const formatted = await prettier.format(await readFile(filePath, 'utf8'), {
            ...prettierConfig,
            parser: 'typescript'
        });
        await writeFile(filePath, formatted);
    }
};

const main = async () => {
    await generateApi({
        name: 'crowdsec-api-generated.ts',
        output: path.join(__dirname, './src/types/generated'),
        templates: path.join(__dirname, './_OATemplates'),
        httpClientType: 'axios',
        url: CROWDSEC_SWAGGER_URL,
        generateClient: false,
        modular: true,
        cleanOutput: true,
        extractRequestParams: true,
        extractRequestBody: true,
        generateRouteTypes: true
    });

    await formatGeneratedFiles();
};

main().catch((e) => console.error(e));
