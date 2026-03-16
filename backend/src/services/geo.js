const EARTH_RADIUS_KM = 6371;

export function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function isValidLatLng(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function haversineDistanceKm(from, to) {
  if (!isValidLatLng(from?.lat, from?.lng) || !isValidLatLng(to?.lat, to?.lng)) {
    return null;
  }
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function normalizeCoordinates(latValue, lngValue) {
  const lat = toFiniteNumber(latValue);
  const lng = toFiniteNumber(lngValue);
  if (!isValidLatLng(lat, lng)) {
    return null;
  }
  return { lat, lng };
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}
