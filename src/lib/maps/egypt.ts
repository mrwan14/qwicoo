import { loadGoogleMaps } from "@/lib/maps/google";

/** Search text that Google resolves to an Egyptian governorate. */
const GOVERNORATE_QUERIES = [
  "Cairo Governorate",
  "Giza Governorate",
  "Alexandria Governorate",
  "Dakahlia Governorate",
  "Red Sea Governorate",
  "Beheira Governorate",
  "Faiyum Governorate",
  "Gharbia Governorate",
  "Ismailia Governorate",
  "Monufia Governorate",
  "Minya Governorate",
  "Qalyubia Governorate",
  "New Valley Governorate",
  "Suez Governorate",
  "Aswan Governorate",
  "Asyut Governorate",
  "Beni Suef Governorate",
  "Port Said Governorate",
  "Damietta Governorate",
  "Sharqia Governorate",
  "South Sinai Governorate",
  "Kafr El Sheikh Governorate",
  "Matrouh Governorate",
  "Luxor Governorate",
  "Qena Governorate",
  "North Sinai Governorate",
  "Sohag Governorate",
] as const;

const AREA_TYPES = [
  "neighborhood",
  "sublocality_level_1",
  "sublocality",
  "administrative_area_level_3",
  "locality",
  "administrative_area_level_2",
] as const;

const CACHE_KEY = "qwicoo-egypt-governorates-v1";

export type MapBounds = { north: number; east: number; south: number; west: number };

export type EgyptGovernorate = {
  placeId: string;
  nameEn: string;
  nameAr: string;
  bounds: MapBounds | null;
};

export type EgyptAreaSuggestion = {
  placeId: string;
  label: string;
  detail: string;
};

let governoratesRequest: Promise<EgyptGovernorate[]> | null = null;

export function loadEgyptGovernorates(): Promise<EgyptGovernorate[]> {
  const stored = readCache();
  if (stored) return Promise.resolve(stored);
  if (!governoratesRequest) {
    governoratesRequest = resolveGovernorates()
      .then((items) => {
        writeCache(items);
        return items;
      })
      .catch((error: unknown) => {
        governoratesRequest = null;
        throw error;
      });
  }
  return governoratesRequest;
}

export async function boundsForGovernorate(nameEn: string): Promise<MapBounds | null> {
  const list = await loadEgyptGovernorates();
  const wanted = compactName(nameEn);
  const match = list.find((item) => compactName(item.nameEn) === wanted);
  if (match?.bounds) return match.bounds;

  const { geocoder } = await maps();
  const { results } = await geocoder.geocode({
    address: `${nameEn}, Egypt`,
    componentRestrictions: { country: "EG" },
    language: "en",
    region: "eg",
  });
  const result = results.find((item) => item.types.includes("administrative_area_level_1")) ?? results[0];
  return result?.geometry.viewport?.toJSON() ?? null;
}

export async function searchEgyptAreas(input: string, bounds: MapBounds | null): Promise<EgyptAreaSuggestion[]> {
  await loadGoogleMaps();
  const places = (await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;
  const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input,
    includedRegionCodes: ["eg"],
    includedPrimaryTypes: ["locality", "sublocality", "neighborhood", "administrative_area_level_2", "administrative_area_level_3"],
    language: "en",
    region: "eg",
    ...(bounds ? { locationRestriction: bounds } : {}),
  });
  return suggestions.flatMap((item) => {
    const prediction = item.placePrediction;
    if (!prediction) return [];
    if (prediction.types.includes("administrative_area_level_1") || prediction.types.includes("country")) return [];
    return [{
      placeId: prediction.placeId,
      label: prediction.mainText?.text || prediction.text.text,
      detail: prediction.secondaryText?.text ?? "",
    }];
  });
}

export async function areaNames(placeId: string): Promise<{ nameEn: string; nameAr: string }> {
  const { geocoder } = await maps();
  const [en, ar] = await Promise.all([
    geocoder.geocode({ placeId, language: "en" }),
    geocoder.geocode({ placeId, language: "ar" }),
  ]);
  const nameEn = areaName(en.results[0]);
  const nameAr = areaName(ar.results[0]);
  if (!nameEn || !nameAr) throw new Error("Google Maps did not return a name for that area");
  return { nameEn, nameAr };
}

async function resolveGovernorates(): Promise<EgyptGovernorate[]> {
  const { geocoder } = await maps();
  const resolved = await mapPool(GOVERNORATE_QUERIES, 4, (query) => resolveGovernorate(geocoder, query));
  const unique = new Map<string, EgyptGovernorate>();
  for (const item of resolved) {
    if (item) unique.set(item.placeId, item);
  }
  const items = [...unique.values()].sort((a, b) => a.nameEn.localeCompare(b.nameEn, "en"));
  if (items.length === 0) throw new Error("Google Maps did not return Egypt's governorates");
  return items;
}

async function resolveGovernorate(geocoder: google.maps.Geocoder, query: string): Promise<EgyptGovernorate | null> {
  const { results } = await geocoder.geocode({
    address: `${query}, Egypt`,
    componentRestrictions: { country: "EG" },
    language: "en",
    region: "eg",
  });
  const result = results.find((item) => item.types.includes("administrative_area_level_1"));
  if (!result) return null;
  const nameEn = componentName(result, ["administrative_area_level_1"]);
  const arabic = await geocoder.geocode({ placeId: result.place_id, language: "ar" });
  const nameAr = componentName(arabic.results[0], ["administrative_area_level_1"]);
  if (!nameEn || !nameAr) return null;
  return {
    placeId: result.place_id,
    nameEn,
    nameAr,
    bounds: result.geometry.viewport?.toJSON() ?? null,
  };
}

function areaName(result: google.maps.GeocoderResult | undefined): string {
  return componentName(result, [...AREA_TYPES]);
}

function componentName(result: google.maps.GeocoderResult | undefined, types: readonly string[]): string {
  if (!result) return "";
  for (const type of types) {
    const found = result.address_components.find((item) => item.types.includes(type));
    if (found?.long_name) return clean(found.long_name);
  }
  return "";
}

function compactName(value: string): string {
  return value.toLowerCase().replace(/governorate/g, "").replace(/[^a-z]/g, "");
}

function clean(value: string): string {
  return value.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").trim();
}

async function maps(): Promise<{ geocoder: google.maps.Geocoder }> {
  await loadGoogleMaps();
  const { Geocoder } = (await google.maps.importLibrary("geocoding")) as google.maps.GeocodingLibrary;
  return { geocoder: new Geocoder() };
}

async function mapPool<T, R>(items: readonly T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await run(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function readCache(): EgyptGovernorate[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EgyptGovernorate[];
    if (!Array.isArray(parsed) || parsed.length < GOVERNORATE_QUERIES.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(items: EgyptGovernorate[]) {
  if (items.length < GOVERNORATE_QUERIES.length) return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(items));
  } catch {
    // Private mode or a full store: the list is fetched again next time.
  }
}
