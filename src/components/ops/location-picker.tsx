"use client";

import { Crosshair, LoaderCircle, MapPin, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { loadGoogleMaps } from "@/lib/maps/google";

export type PickedLocation = { latitude: number; longitude: number; address: string };

const CAIRO = { lat: 30.0444, lng: 31.2357 };
const control = "h-11 w-full rounded-lg border px-3 text-sm";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value?: PickedLocation | null;
  radiusMeters?: number;
  onConfirm: (location: PickedLocation) => void;
};

export function LocationPickerDialog({ open, onOpenChange, value, radiusMeters = 150, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Branch location</DialogTitle>
          <DialogDescription>Search for the address, then drag the map until the pin sits on the entrance.</DialogDescription>
        </DialogHeader>
        {open ? (
          <PickerBody
            value={value}
            radiusMeters={radiusMeters}
            onConfirm={(location) => {
              onConfirm(location);
              onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PickerBody({ value, radiusMeters, onConfirm }: Omit<Props, "open" | "onOpenChange"> & { radiusMeters: number }) {
  const mapNode = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const circle = useRef<google.maps.Circle | null>(null);
  const geocoder = useRef<google.maps.Geocoder | null>(null);
  const skipGeocode = useRef(false);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [center, setCenter] = useState(value ? { lat: value.latitude, lng: value.longitude } : CAIRO);
  const [address, setAddress] = useState(value?.address ?? "");
  const [resolving, setResolving] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<google.maps.GeocoderResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadGoogleMaps();
        const [{ Map, Circle }, { Geocoder }] = await Promise.all([
          google.maps.importLibrary("maps") as Promise<google.maps.MapsLibrary>,
          google.maps.importLibrary("geocoding") as Promise<google.maps.GeocodingLibrary>,
        ]);
        if (cancelled || !mapNode.current) return;
        const start = value ? { lat: value.latitude, lng: value.longitude } : CAIRO;
        const instance = new Map(mapNode.current, {
          center: start,
          zoom: value ? 17 : 12,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: "greedy",
        });
        circle.current = new Circle({
          map: instance,
          center: start,
          radius: radiusMeters,
          strokeColor: "#2563eb",
          strokeOpacity: 0.6,
          strokeWeight: 1,
          fillColor: "#2563eb",
          fillOpacity: 0.12,
          clickable: false,
        });
        instance.addListener("center_changed", () => {
          const next = instance.getCenter();
          if (next) circle.current?.setCenter(next);
        });
        instance.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (event.latLng) instance.panTo(event.latLng);
        });
        instance.addListener("idle", () => {
          const next = instance.getCenter();
          if (!next) return;
          setCenter({ lat: next.lat(), lng: next.lng() });
          if (skipGeocode.current) {
            skipGeocode.current = false;
            return;
          }
          void reverseGeocode(next);
        });
        // The first idle fires on load; keep the saved address instead of re-geocoding it.
        skipGeocode.current = Boolean(value?.address);
        map.current = instance;
        geocoder.current = new Geocoder();
        setStatus("ready");
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Google Maps failed to load");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      circle.current?.setMap(null);
      map.current = null;
    };
    // The map is built once per open; later value changes come from the map itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    circle.current?.setRadius(radiusMeters);
  }, [radiusMeters]);

  async function search() {
    const input = query.trim();
    if (!geocoder.current || input.length < 3) return;
    setSearching(true);
    setError("");
    try {
      const { results: found } = await geocoder.current.geocode({
        address: input,
        bounds: map.current?.getBounds() ?? undefined,
      });
      if (found.length === 1) choose(found[0]);
      else setResults(found.slice(0, 6));
    } catch {
      setResults([]);
      setError("No matching address. Try a street, area, or city.");
    } finally {
      setSearching(false);
    }
  }

  async function reverseGeocode(location: google.maps.LatLng) {
    if (!geocoder.current) return;
    setResolving(true);
    try {
      const { results } = await geocoder.current.geocode({ location });
      setAddress(results[0]?.formatted_address ?? "");
    } catch {
      setAddress("");
    } finally {
      setResolving(false);
    }
  }

  function choose(result: google.maps.GeocoderResult) {
    setResults([]);
    setQuery(result.formatted_address);
    if (!map.current) return;
    skipGeocode.current = true;
    map.current.setCenter(result.geometry.location);
    map.current.setZoom(17);
    setAddress(result.formatted_address);
  }

  function locateMe() {
    if (!navigator.geolocation) {
      setError("This browser cannot share its location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        map.current?.setCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
        map.current?.setZoom(18);
      },
      () => {
        setLocating(false);
        setError("Location permission was denied.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="grid gap-3">
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={`${control} ps-9`}
            placeholder="Search street, area, or city"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              void search();
            }}
            disabled={status !== "ready"}
          />
        </div>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm disabled:opacity-50"
          onClick={() => void search()}
          disabled={status !== "ready" || searching || query.trim().length < 3}
        >
          {searching ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Search
        </button>
        {results.length > 0 ? (
          <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
            {results.map((result) => (
              <li key={result.place_id}>
                <button
                  type="button"
                  className="w-full rounded-md px-3 py-2 text-start text-sm hover:bg-muted"
                  onClick={() => choose(result)}
                >
                  {result.formatted_address}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="relative h-80 overflow-hidden rounded-lg border bg-muted sm:h-96">
        <div ref={mapNode} className="absolute inset-0" />
        {status === "ready" ? (
          <>
            <MapPin aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 size-9 -translate-x-1/2 -translate-y-full fill-primary text-primary-foreground drop-shadow" />
            <button
              type="button"
              className="absolute end-3 bottom-3 inline-flex min-h-10 items-center gap-2 rounded-full bg-background px-3 text-sm shadow-md"
              onClick={locateMe}
              disabled={locating}
            >
              {locating ? <LoaderCircle className="size-4 animate-spin" /> : <Crosshair className="size-4" />}
              My location
            </button>
          </>
        ) : null}
        {status === "loading" ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Loading map
          </div>
        ) : null}
        {status === "error" ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-destructive">{error}</div>
        ) : null}
      </div>

      <div className="grid gap-1 text-sm">
        <p className="min-h-5">{resolving ? "Finding address…" : address || "Move the map to place the pin."}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {center.lat.toFixed(6)}, {center.lng.toFixed(6)} · geofence {radiusMeters} m
        </p>
        {status === "ready" && error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>

      <button
        type="button"
        className="min-h-11 rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
        disabled={status !== "ready" || resolving}
        onClick={() => onConfirm({ latitude: round(center.lat), longitude: round(center.lng), address })}
      >
        Use this location
      </button>
    </div>
  );
}

function round(value: number) {
  return Math.round(value * 1e6) / 1e6;
}
