const DEFAULT_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  'http://localhost:3005',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:5177',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:3003',
  'http://127.0.0.1:3004',
  'http://127.0.0.1:3005',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:5176',
  'http://127.0.0.1:5177',
];

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

export function parseAllowedCorsOrigins(
  raw: string | undefined = process.env.CORS_ORIGIN,
): string[] {
  if (!raw || !raw.trim()) {
    return process.env.NODE_ENV === 'production' ? [] : DEFAULT_DEV_ORIGINS;
  }
  return raw
    .split(',')
    .map(normalizeOrigin)
    .filter((origin) => Boolean(origin) && origin !== '*');
}

export function buildCorsOptions(): {
  origin: (
    requestOrigin: string | undefined,
    callback: (err: Error | null, origin?: string | boolean) => void,
  ) => void;
  credentials: boolean;
  maxAge: number;
} {
  return {
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) {
        callback(null, false);
        return;
      }
      const normalizedRequest = normalizeOrigin(requestOrigin);
      const allowedOrigins = parseAllowedCorsOrigins();
      if (allowedOrigins.includes(normalizedRequest)) {
        callback(null, requestOrigin);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    maxAge: 86400,
  };
}
