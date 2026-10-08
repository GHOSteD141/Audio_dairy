import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  /**
   * The session object returned by `getServerSession()` / `useSession()`.
   * We forward the Google OAuth access token so API routes can talk to Drive.
   */
  interface Session {
    accessToken?: string;
    user?: DefaultSession["user"];
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    error?: string;
  }
}
