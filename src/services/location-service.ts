import * as Location from "expo-location";

export interface LocationSearchResult {
  id: string;
  name: string;
  fullName: string;
  latitude: number;
  longitude: number;
  barangay?: string;
  city?: string;
}

// Popular Iligan City farming & market hubs as instant fallback
export const POPULAR_FARM_LOCATIONS: LocationSearchResult[] = [
  {
    id: "palao",
    name: "Pala-o Market",
    fullName: "Pala-o, Iligan City, Lanao del Norte",
    latitude: 8.2283,
    longitude: 124.2452,
    barangay: "Pala-o",
    city: "Iligan City",
  },
  {
    id: "tipanoy",
    name: "Tipanoy Farming Hub",
    fullName: "Tipanoy, Iligan City, Lanao del Norte",
    latitude: 8.212,
    longitude: 124.254,
    barangay: "Tipanoy",
    city: "Iligan City",
  },
  {
    id: "delcarmen",
    name: "Del Carmen Agrimart",
    fullName: "Del Carmen, Iligan City, Lanao del Norte",
    latitude: 8.2345,
    longitude: 124.243,
    barangay: "Del Carmen",
    city: "Iligan City",
  },
  {
    id: "tubod",
    name: "Tubod Market & Port",
    fullName: "Tubod, Iligan City, Lanao del Norte",
    latitude: 8.209,
    longitude: 124.237,
    barangay: "Tubod",
    city: "Iligan City",
  },
  {
    id: "luinab",
    name: "Luinab Organic Garden",
    fullName: "Luinab, Iligan City, Lanao del Norte",
    latitude: 8.2235,
    longitude: 124.261,
    barangay: "Luinab",
    city: "Iligan City",
  },
  {
    id: "tambo",
    name: "Tambo Terminal & Produce Hub",
    fullName: "Tambo, Iligan City, Lanao del Norte",
    latitude: 8.2415,
    longitude: 124.248,
    barangay: "Tambo",
    city: "Iligan City",
  },
  {
    id: "suarez",
    name: "Suarez Agricultural District",
    fullName: "Suarez, Iligan City, Lanao del Norte",
    latitude: 8.1872,
    longitude: 124.2185,
    barangay: "Suarez",
    city: "Iligan City",
  },
  {
    id: "ditucalan",
    name: "Ditucalan Fresh Springs",
    fullName: "Ditucalan, Iligan City, Lanao del Norte",
    latitude: 8.195,
    longitude: 124.278,
    barangay: "Ditucalan",
    city: "Iligan City",
  },
];

/**
 * Live search for locations across Iligan City and the Philippines
 * Uses OpenStreetMap Nominatim with fallback to known agricultural barangays
 */
export async function searchLocationsApi(
  query: string,
): Promise<LocationSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    // Bounded search prioritizing Philippines / Iligan area
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      trimmed,
    )}&format=json&addressdetails=1&limit=6&countrycodes=ph`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "LocalFarmApp/1.0 (local-farm-mobile-app)",
      },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((item: any) => {
          const addr = item.address || {};
          const barangay =
            addr.quarter ||
            addr.suburb ||
            addr.village ||
            addr.neighbourhood ||
            addr.hamlet ||
            "";
          const city =
            addr.city || addr.town || addr.municipality || "Iligan City";

          let shortName = item.name || "";
          if (!shortName) {
            shortName = barangay ? `${barangay}, ${city}` : item.display_name.split(",")[0];
          }

          return {
            id: String(item.place_id || Math.random()),
            name: shortName,
            fullName: item.display_name,
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
            barangay: barangay || undefined,
            city,
          };
        });
      }
    }
  } catch (err) {
    // Network timeout or offline - fall back to local popular search
  }

  // Fallback matching against local popular hubs
  const lowerQuery = trimmed.toLowerCase();
  return POPULAR_FARM_LOCATIONS.filter(
    (loc) =>
      loc.name.toLowerCase().includes(lowerQuery) ||
      loc.barangay?.toLowerCase().includes(lowerQuery) ||
      loc.fullName.toLowerCase().includes(lowerQuery),
  );
}

/**
 * Reverse geocodes coordinates (lat, lng) into human-friendly location string
 * e.g., "Pala-o, Iligan City"
 */
export async function reverseGeocodeApi(
  latitude: number,
  longitude: number,
): Promise<string> {
  // 1. Try native expo-location reverseGeocodeAsync first
  try {
    const addresses = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    if (addresses && addresses.length > 0) {
      const addr = addresses[0];
      const part1 =
        addr.name ||
        addr.street ||
        addr.district ||
        addr.subregion ||
        "";
      const part2 = addr.city || addr.region || "Iligan City";

      if (part1 && part2 && part1.toLowerCase() !== part2.toLowerCase()) {
        return `${part1}, ${part2}`;
      } else if (part1 || part2) {
        return part1 || part2;
      }
    }
  } catch {
    // Continue to Nominatim fallback
  }

  // 2. Fallback to OpenStreetMap Nominatim reverse geocode
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "LocalFarmApp/1.0 (local-farm-mobile-app)",
      },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const barangay =
        addr.quarter ||
        addr.suburb ||
        addr.village ||
        addr.neighbourhood ||
        addr.hamlet ||
        "";
      const city =
        addr.city || addr.town || addr.municipality || "Iligan City";

      if (barangay) {
        return `${barangay}, ${city}`;
      }
      if (addr.road) {
        return `${addr.road}, ${city}`;
      }
      if (data.display_name) {
        const parts = data.display_name.split(",").map((s: string) => s.trim());
        return parts.slice(0, 2).join(", ");
      }
    }
  } catch {
    // Fallback to coordinates
  }

  // 3. Fallback: match closest known static location within ~600 meters
  const closest = POPULAR_FARM_LOCATIONS.find(
    (loc) =>
      Math.hypot(loc.latitude - latitude, loc.longitude - longitude) < 0.006,
  );
  if (closest) {
    return closest.fullName.split(",").slice(0, 2).join(",");
  }

  return `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
}

/**
 * Gets user's current GPS position via expo-location
 */
export async function getCurrentDeviceLocation(): Promise<{
  latitude: number;
  longitude: number;
} | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      return null;
    }

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    };
  } catch (err) {
    return null;
  }
}
