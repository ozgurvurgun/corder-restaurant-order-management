export interface StaffShiftConfig {
  shiftRestrictionEnabled?: boolean | null;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  shiftCutoffOffsetMinutes?: number | null;
}

export interface ShiftAccessEvaluation {
  allowed: boolean;
  effectiveStartTime: string | null;
  effectiveEndTime: string | null;
  remainingSeconds: number | null;
  shiftAccessUntilIso: string | null;
  reason?: string;
}

export interface RestaurantGeofenceConfig {
  terminalLocationRestrictionEnabled?: boolean | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  locationRadiusMeters?: number | null;
}

export interface GeofenceAccessEvaluation {
  allowed: boolean;
  distanceMeters?: number;
  reason?: string;
}

function parseHhMm(raw?: string | null): number | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(trimmed);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatMinutesToHhMm(totalMinutes: number): string {
  const norm = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getIstanbulNowMinutesAndSeconds(now = new Date()): {
  minutesOfDay: number;
  secondsIntoMinute: number;
} {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  let hour = 0;
  let minute = 0;
  let second = 0;
  for (const p of parts) {
    if (p.type === 'hour') hour = Number(p.value) % 24;
    else if (p.type === 'minute') minute = Number(p.value);
    else if (p.type === 'second') second = Number(p.value);
  }
  return {
    minutesOfDay: hour * 60 + minute,
    secondsIntoMinute: second,
  };
}

export function evaluateStaffShiftAccess(
  staff: StaffShiftConfig,
  now = new Date(),
): ShiftAccessEvaluation {
  if (!staff.shiftRestrictionEnabled) {
    return {
      allowed: true,
      effectiveStartTime: null,
      effectiveEndTime: null,
      remainingSeconds: null,
      shiftAccessUntilIso: null,
    };
  }

  const startMins = parseHhMm(staff.shiftStartTime);
  const rawEndMins = parseHhMm(staff.shiftEndTime);
  if (startMins === null || rawEndMins === null) {
    return {
      allowed: false,
      effectiveStartTime: null,
      effectiveEndTime: null,
      remainingSeconds: 0,
      shiftAccessUntilIso: null,
      reason:
        'Mesai saat kısıtlaması etkin ancak başlangıç veya bitiş saati geçersiz/eksik. Lütfen yöneticinizle iletişime geçin.',
    };
  }

  const offset = Number(staff.shiftCutoffOffsetMinutes || 0);
  const effectiveEndMins = ((rawEndMins + offset) % 1440 + 1440) % 1440;
  const effectiveStartTime = formatMinutesToHhMm(startMins);
  const effectiveEndTime = formatMinutesToHhMm(effectiveEndMins);

  if (startMins === effectiveEndMins) {
    return {
      allowed: false,
      effectiveStartTime,
      effectiveEndTime,
      remainingSeconds: 0,
      shiftAccessUntilIso: null,
      reason: `Mesai erişim aralığınız geçersiz (${effectiveStartTime} - ${effectiveEndTime}). Lütfen yöneticinizle iletişime geçin.`,
    };
  }

  const { minutesOfDay, secondsIntoMinute } = getIstanbulNowMinutesAndSeconds(now);
  const currentTotalSeconds = minutesOfDay * 60 + secondsIntoMinute;
  const startTotalSeconds = startMins * 60;
  const endTotalSeconds = effectiveEndMins * 60;

  let insideWindow = false;
  let remainingSeconds = 0;

  if (startTotalSeconds < endTotalSeconds) {
    insideWindow =
      currentTotalSeconds >= startTotalSeconds &&
      currentTotalSeconds < endTotalSeconds;
    if (insideWindow) {
      remainingSeconds = endTotalSeconds - currentTotalSeconds;
    }
  } else {
    // Overnight shift (e.g. 18:00 -> 02:30)
    insideWindow =
      currentTotalSeconds >= startTotalSeconds ||
      currentTotalSeconds < endTotalSeconds;
    if (insideWindow) {
      remainingSeconds =
        currentTotalSeconds >= startTotalSeconds
          ? 86400 - currentTotalSeconds + endTotalSeconds
          : endTotalSeconds - currentTotalSeconds;
    }
  }

  if (!insideWindow) {
    return {
      allowed: false,
      effectiveStartTime,
      effectiveEndTime,
      remainingSeconds: 0,
      shiftAccessUntilIso: null,
      reason: `Mesai saatleriniz dışında terminale erişemezsiniz. Erişim saatleriniz: ${effectiveStartTime} - ${effectiveEndTime}.`,
    };
  }

  const shiftAccessUntilIso = new Date(
    now.getTime() + remainingSeconds * 1000,
  ).toISOString();

  return {
    allowed: true,
    effectiveStartTime,
    effectiveEndTime,
    remainingSeconds,
    shiftAccessUntilIso,
  };
}

export function computeHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function evaluateRestaurantGeofenceAccess(
  restaurant: RestaurantGeofenceConfig,
  clientCoords?: { latitude?: number | null; longitude?: number | null } | null,
): GeofenceAccessEvaluation {
  if (!restaurant.terminalLocationRestrictionEnabled) {
    return { allowed: true };
  }
  if (
    restaurant.locationLatitude == null ||
    restaurant.locationLongitude == null ||
    String(restaurant.locationLatitude).trim() === '' ||
    String(restaurant.locationLongitude).trim() === ''
  ) {
    return { allowed: true };
  }
  const restLat = Number(restaurant.locationLatitude);
  const restLng = Number(restaurant.locationLongitude);
  if (!Number.isFinite(restLat) || !Number.isFinite(restLng)) {
    return { allowed: true };
  }

  const clientLat =
    clientCoords?.latitude != null ? Number(clientCoords.latitude) : NaN;
  const clientLng =
    clientCoords?.longitude != null ? Number(clientCoords.longitude) : NaN;

  if (!Number.isFinite(clientLat) || !Number.isFinite(clientLng)) {
    return {
      allowed: false,
      reason:
        'Bu işletmede konum doğrulaması zorunludur. Terminale erişmek için cihazınızın konum (GPS) iznini açmalısınız.',
    };
  }

  const allowedRadius = Math.max(
    20,
    Math.min(10000, Number(restaurant.locationRadiusMeters || 150)),
  );
  const distanceMeters = computeHaversineDistanceMeters(
    restLat,
    restLng,
    clientLat,
    clientLng,
  );

  if (distanceMeters > allowedRadius) {
    const distLabel =
      distanceMeters >= 1000
        ? `${(distanceMeters / 1000).toFixed(1)} km`
        : `${distanceMeters} m`;
    return {
      allowed: false,
      distanceMeters,
      reason: `Restoran konumundan uzakta olduğunuz için terminale erişemezsiniz (Mesafeniz: ${distLabel}, İzin verilen: ${allowedRadius} m).`,
    };
  }

  return {
    allowed: true,
    distanceMeters,
  };
}
