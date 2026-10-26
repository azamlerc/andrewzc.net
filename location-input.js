// Editor presentation only. Entity storage is a GeoJSON Point in location.
export function formatLocation(location) {
  if (location?.type !== "Point" || !Array.isArray(location.coordinates)
      || location.coordinates.length !== 2) return "";
  const [lon, lat] = location.coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)
      || Math.abs(lat) > 90 || Math.abs(lon) > 180) return "";
  return `${lat}, ${lon}`;
}

function parseComponent(input, directions) {
  const text = input.trim().toUpperCase().replace(/O/g, "W");
  const match = text.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*°?\s*(?:(\d+(?:\.\d+)?)\s*['′`]\s*)?(?:(\d+(?:\.\d+)?)\s*["″]\s*)?([NSEW]?)$/);
  if (!match || (match[4] && !directions.includes(match[4]))) return null;
  const degrees = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  if (minutes >= 60 || seconds >= 60 || ((match[2] || match[3]) && !text.includes("°"))) return null;
  const magnitude = Math.abs(degrees) + minutes / 60 + seconds / 3600;
  const negative = match[4] ? /[SW]/.test(match[4]) : match[1].startsWith("-");
  return negative ? -magnitude : magnitude;
}

export function parseLocationInput(input) {
  if (typeof input !== "string" || !input.trim()) return null;
  const text = input.trim();
  const parts = text.includes(",") ? text.split(",")
    : text.match(/^(.+?[NS])\s+(.+?[EWO])$/i)?.slice(1);
  if (!parts || parts.length !== 2) return null;
  const lat = parseComponent(parts[0], "NS");
  const lon = parseComponent(parts[1], "EW");
  if (!Number.isFinite(lat) || !Number.isFinite(lon)
      || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

export function normalizeLocationInput(input) {
  const point = parseLocationInput(input);
  return point ? { ...point, text: `${point.lat}, ${point.lon}` } : null;
}
