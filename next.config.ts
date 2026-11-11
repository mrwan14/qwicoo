import type { NextConfig } from "next";

/**
 * Browser hardening for every page. The API sets its own headers; these cover the web app.
 * Receipt printing uses a same-site iframe, so framing is limited to this site, not denied.
 * The content policy starts as report-only: it logs what it would block (Google Maps, Paymob,
 * images) in the browser console without breaking anything. Enforce it once that log is clean.
 */
const CONTENT_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https:",
  "frame-ancestors 'self'",
  "form-action 'self' https:",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), payment=(self)" },
  { key: "Content-Security-Policy-Report-Only", value: CONTENT_POLICY },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.3"],
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};
export default nextConfig;
