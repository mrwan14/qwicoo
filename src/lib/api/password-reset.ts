import type { NextRequest } from "next/server";

import { createApiClient } from "@/lib/api/server-client";

/**
 * Public password-reset paths. The generated schema does not list them yet
 * (regenerate with `npm run gen:api` once the API publishes them, then delete
 * this augmentation if the generated paths conflict).
 */
declare module "@/lib/api/schema" {
  interface paths {
    "/api/v1/auth/forgot-password": {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      get?: never;
      put?: never;
      post: operations["request_password_reset_api_v1_auth_forgot_password_post"];
      delete?: never;
      options?: never;
      head?: never;
      patch?: never;
      trace?: never;
    };
    "/api/v1/auth/reset-password/preview": {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      get: operations["preview_password_reset_api_v1_auth_reset_password_preview_get"];
      put?: never;
      post?: never;
      delete?: never;
      options?: never;
      head?: never;
      patch?: never;
      trace?: never;
    };
    "/api/v1/auth/reset-password": {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      get?: never;
      put?: never;
      post: operations["confirm_password_reset_api_v1_auth_reset_password_post"];
      delete?: never;
      options?: never;
      head?: never;
      patch?: never;
      trace?: never;
    };
  }

  interface operations {
    request_password_reset_api_v1_auth_forgot_password_post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            email: string;
          };
        };
      };
      responses: {
        /** @description Same body whether or not the email has an account */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              message: string;
            };
          };
        };
        /** @description Validation Error */
        422: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["HTTPValidationError"];
          };
        };
        /** @description Rate limited */
        429: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    preview_password_reset_api_v1_auth_reset_password_preview_get: {
      parameters: {
        query: {
          token: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Successful Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              email: string;
              /** Format: date-time */
              expires_at: string;
            };
          };
        };
        /** @description Invalid or already used */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
        /** @description Expired */
        410: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
        /** @description Validation Error */
        422: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["HTTPValidationError"];
          };
        };
      };
    };
    confirm_password_reset_api_v1_auth_reset_password_post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            token: string;
            password: string;
          };
        };
      };
      responses: {
        /** @description Successful Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              access_token: string;
              token_type: string;
              expires_in: number;
              user: components["schemas"]["UserResponse"];
            };
          };
        };
        /** @description Inactive account */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
        /** @description Invalid or already used */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
        /** @description Expired */
        410: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
        /** @description Validation Error */
        422: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": components["schemas"]["HTTPValidationError"];
          };
        };
      };
    };
  }

}

/**
 * Auth client with no bearer token. These routes are public; do not copy
 * Authorization or the staff session cookie onto the upstream request.
 */
export function createPublicApiClient() {
  return createApiClient();
}

/** So the API can rate-limit the caller rather than this server. */
export function callerIpHeaders(request: NextRequest): { "x-forwarded-for": string } | undefined {
  const forwarded = request.headers.get("x-forwarded-for")?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const value = forwarded || realIp;
  if (!value) return undefined;
  return { "x-forwarded-for": value };
}
