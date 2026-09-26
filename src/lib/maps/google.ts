const CALLBACK = "__qwicooMapsReady";

let loading: Promise<void> | null = null;

export const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

export function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Maps needs a browser"));
  if (typeof window.google?.maps?.importLibrary === "function") return Promise.resolve();
  if (loading) return loading;
  if (!mapsApiKey) return Promise.reject(new Error("Google Maps key is not configured"));

  loading = new Promise<void>((resolve, reject) => {
    const params = new URLSearchParams({
      key: mapsApiKey,
      v: "weekly",
      loading: "async",
      callback: CALLBACK,
      language: document.documentElement.lang || "en",
    });
    (window as unknown as Record<string, () => void>)[CALLBACK] = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("Google Maps failed to load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}
