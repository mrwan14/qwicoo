# Fonts

Self-hosted copies of the Google Fonts files the app used to load through `next/font/google`. These are the
same files Google serves, downloaded with the requests `next/font/google` makes. They're kept in the repo
because the Google Fonts API sometimes returns file URLs without an extension (`fonts.gstatic.com/l/font?kit=…`)
to build machines such as GitHub Actions, and `next/font/google` then fails the build.

| File | Family | Weights | Subset | Used by |
| --- | --- | --- | --- | --- |
| `geist-latin.woff2` | Geist (variable) | 100–900 | latin | `src/app/layout.tsx` |
| `geist-mono-latin.woff2` | Geist Mono (variable) | 100–900 | latin | `src/app/layout.tsx` |
| `fraunces-latin.woff2` | Fraunces (variable) | 100–900 | latin | `src/app/layout.tsx`, `src/features/guest/guest-fonts.ts` |
| `archivo-black-latin-400.woff2` | Archivo Black | 400 | latin | `src/app/layout.tsx` |
| `ibm-plex-sans-arabic-arabic-{400,500,600,700}.woff2` | IBM Plex Sans Arabic | 400–700 | arabic | `src/app/layout.tsx` |
| `nunito-latin.woff2` | Nunito (variable) | 600–800 used | latin | `src/app/[locale]/layout.tsx` |
| `baloo-bhaijaan-2-arabic.woff2` | Baloo Bhaijaan 2 (variable) | 400–700 used | arabic | `src/app/[locale]/layout.tsx` |
| `inter-latin.woff2` | Inter (variable) | 400–700 used | latin | `src/features/guest/guest-fonts.ts`, `src/components/ops/kit/fonts.ts` |
| `cairo-arabic.woff2`, `cairo-latin.woff2` | Cairo (variable) | 400–700 used | arabic, latin | `src/features/guest/guest-fonts.ts` |

All are licensed under the SIL Open Font License 1.1, which allows bundling them with the app.

To add a font or weight, download the `woff2` for the subset you need from the Google Fonts CSS API
(`https://fonts.googleapis.com/css2?family=<Family>:wght@<weights>&display=swap`, requested with a current
Chrome user agent), save it here, and load it with `next/font/local`.

`fallbacks.css` holds the size-adjusted Arial / Times New Roman faces shown while a font loads, with the exact
metrics `next/font/google` generated, so layout and line heights match what Google-hosted fonts produced. Each
`localFont` call sets `adjustFontFallback: false` and names its face in `fallback`.
