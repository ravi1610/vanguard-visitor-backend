export default () => {
  const isProduction = process.env.NODE_ENV === 'production';

  // Fail fast in production if critical env vars are missing
  if (isProduction && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  if (isProduction && !process.env.SETTINGS_ENCRYPTION_KEY) {
    throw new Error('SETTINGS_ENCRYPTION_KEY environment variable is required in production');
  }

  return {
    port: parseInt(process.env.PORT ?? '3000', 10),
    database: {
      url: process.env.DATABASE_URL,
    },
    jwt: {
      secret: process.env.JWT_SECRET ?? 'dev-only-secret-change-me',
      expiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    },
    cors: {
      origins: process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
        : ['http://localhost:5173', 'http://localhost:4173'],
    },
    redis: {
      url: process.env.REDIS_URL ?? '',
    },
    app: {
      url: process.env.APP_URL ?? 'http://localhost:5173',
    },
    settings: {
      encryptionKey: process.env.SETTINGS_ENCRYPTION_KEY ?? 'dev-only-32-char-key-change-me!!',
    },
  };
};
