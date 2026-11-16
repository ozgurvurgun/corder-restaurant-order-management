const DEFAULT_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:3003',
  'http://127.0.0.1:3004',
];

export function parseAllowedCorsOrigins(
  raw: string | undefined = process.env.CORS_ORIGIN,
): string[] {
  if (!raw || !raw.trim()) {
    return process.env.NODE_ENV === 'production' ? [] : DEFAULT_DEV_ORIGINS;
  }
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => Boolean(origin) && origin !== '*');
}

export function buildCorsOptions(): {
  origin: (
    requestOrigin: string | undefined,
    callback: (err: Error | null, origin?: string | boolean) => void,
  ) => void;
  credentials: boolean;
} {
  return {
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) {
        callback(null, false);
        return;
      }
      const allowedOrigins = parseAllowedCorsOrigins();
      if (allowedOrigins.includes(requestOrigin)) {
        callback(null, requestOrigin);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  };
}
