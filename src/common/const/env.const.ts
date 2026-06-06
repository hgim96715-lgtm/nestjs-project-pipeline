const env = 'ENV';
const dbType = 'DB_TYPE';
const dbHost = 'DB_HOST';
const dbPort = 'DB_PORT';
const dbUsername = 'DB_USERNAME';
const dbPassword = 'DB_PASSWORD';
const dbDatabase = 'DB_DATABASE';
const saltrounds = 'SALT_ROUNDS';
const accessTokenSecret = 'ACCESS_TOKEN_SECRET';
const refreshTokenSecret = 'REFRESH_TOKEN_SECRET';
const awsRegion = 'AWS_REGION';
const awsS3Bucket = 'AWS_S3_BUCKET';
const redisHost = 'REDIS_HOST';
const redisPort = 'REDIS_PORT';
const redisTls = 'REDIS_TLS';
const redisInsightPort = 'REDIS_INSIGHT_PORT';
const sessionSecret = 'SESSION_SECRET';
const databaseUrl = 'DATABASE_URL';

export type RedisConnectionOptions = {
    host: string;
    port: number;
    url: string;
    tls: boolean;
};

/** REDIS_HOST에 포트가 포함된 경우 분리하고, Serverless ElastiCache는 TLS URL을 사용한다. */
export function parseRedisConnection(
    rawHost: string,
    port: number,
    tlsEnv?: string,
): RedisConnectionOptions {
    let host = rawHost.trim().replace(/^rediss?:\/\//, '');
    let resolvedPort = port;

    const colonIndex = host.lastIndexOf(':');
    if (colonIndex > 0 && /^\d+$/.test(host.slice(colonIndex + 1))) {
        resolvedPort = Number(host.slice(colonIndex + 1));
        host = host.slice(0, colonIndex);
    }

    const tls = tlsEnv === 'true' || (tlsEnv !== 'false' && host.includes('.serverless.'));
    const scheme = tls ? 'rediss' : 'redis';

    return {
        host,
        port: resolvedPort,
        url: `${scheme}://${host}:${resolvedPort}`,
        tls,
    };
}

export const envVariableKeys = {
    env,
    dbType,
    dbHost,
    dbPort,
    dbUsername,
    dbPassword,
    dbDatabase,
    saltrounds,
    accessTokenSecret,
    refreshTokenSecret,
    awsRegion,
    awsS3Bucket,
    redisHost,
    redisPort,
    redisTls,
    redisInsightPort,
    sessionSecret,
    databaseUrl,
};
