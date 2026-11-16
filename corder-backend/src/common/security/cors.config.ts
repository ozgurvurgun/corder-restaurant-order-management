export function parseAllowedCorsOrigins(
  raw: string | undefined = process.env.CORS_ORIGIN,
): string[] {
  if (!raw) return [];
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

