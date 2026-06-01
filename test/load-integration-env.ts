import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const root = process.cwd();

function loadEnvFile(filePath: string, override = false) {
    if (!existsSync(filePath)) {
        return;
    }

    for (const line of readFileSync(filePath, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }

        const separator = trimmed.indexOf('=');
        if (separator === -1) {
            continue;
        }

        const key = trimmed.slice(0, separator).trim();
        if (!override && process.env[key] !== undefined) {
            continue;
        }

        let value = trimmed.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        process.env[key] = value;
    }
}

loadEnvFile(resolve(root, '.env'));
loadEnvFile(resolve(root, '.env.test'), true);

const dbName = process.env.DB_DATABASE;

if (!dbName?.endsWith('_test')) {
    throw new Error(
        [
            'Integration tests must use a dedicated test database.',
            'Copy .env.test.example to .env.test and set DB_DATABASE=movie_test (or *\_test).',
            `Current DB_DATABASE: ${dbName ?? '(unset)'}`,
        ].join(' '),
    );
}
