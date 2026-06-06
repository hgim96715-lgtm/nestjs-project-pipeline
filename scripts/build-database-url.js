#!/usr/bin/env node

const username = process.env.DB_USERNAME ?? '';
const password = process.env.DB_PASSWORD ?? '';
const host = process.env.DB_HOST ?? '';
const database = process.env.DB_DATABASE ?? '';
const port = String(process.env.DB_PORT || '5432').trim();

if (!/^\d+$/.test(port)) {
    console.error(`Invalid DB_PORT: ${JSON.stringify(port)}`);
    process.exit(1);
}

const hostOverride = process.argv.find((arg) => arg.startsWith('--host='))?.slice('--host='.length);
const sslMode = process.argv.includes('--ssl-no-verify') ? 'no-verify' : null;

const resolvedHost = hostOverride ?? host;
if (!resolvedHost) {
    console.error('DB_HOST is required');
    process.exit(1);
}

const user = encodeURIComponent(username);
const pass = encodeURIComponent(password);
const db = database;

const params = new URLSearchParams();
if (sslMode) {
    params.set('sslmode', sslMode);
}

const query = params.toString();
const url = `postgresql://${user}:${pass}@${resolvedHost}:${port}/${db}${query ? `?${query}` : ''}`;

process.stdout.write(url);
