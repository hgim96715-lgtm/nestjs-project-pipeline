const { existsSync, readFileSync } = require('fs');
const { resolve } = require('path');
const { Client } = require('pg');

const root = resolve(__dirname, '..');

function loadEnvFile(filePath) {
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
        let value = trimmed.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        process.env[key] = value;
    }
}

loadEnvFile(resolve(root, '.env'));
loadEnvFile(resolve(root, '.env.test'));

const dbName = process.env.DB_DATABASE;

if (!dbName?.endsWith('_test')) {
    console.error('Set DB_DATABASE to a *_test database in .env.test (see .env.test.example).');
    process.exit(1);
}

if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
    console.error(`Invalid DB_DATABASE name: ${dbName}`);
    process.exit(1);
}

async function main() {
    const client = new Client({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: 'postgres',
    });

    await client.connect();

    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);

    if (exists.rowCount === 0) {
        await client.query(`CREATE DATABASE "${dbName}"`);
        console.log(`Created database "${dbName}".`);
    } else {
        console.log(`Database "${dbName}" already exists.`);
    }

    await client.end();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
