// SSO stub (Phase 5): Google / Microsoft / LinkedIn OIDC entry points.
// Enabled via env SSO_GOOGLE=1 etc. Full token exchange plugs in here;
// architecture keeps local password auth working side-by-side.

export function ssoProviders(): { id: string; name: string; enabled: boolean; url: string | null }[] {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const google = process.env.GOOGLE_CLIENT_ID;
  const ms = process.env.MS_CLIENT_ID;
  const li = process.env.LINKEDIN_CLIENT_ID;
  return [
    {
      id: "google", name: "Google", enabled: Boolean(google),
      url: google ? `https://accounts.google.com/o/oauth2/v2/auth?client_id=${google}&redirect_uri=${encodeURIComponent(appUrl + "/api/v1/auth/sso?provider=google")}&response_type=code&scope=${encodeURIComponent("openid email profile")}` : null,
    },
    {
      id: "microsoft", name: "Microsoft", enabled: Boolean(ms),
      url: ms ? `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${ms}&redirect_uri=${encodeURIComponent(appUrl + "/api/v1/auth/sso?provider=microsoft")}&response_type=code&scope=${encodeURIComponent("openid email profile")}` : null,
    },
    {
      id: "linkedin", name: "LinkedIn", enabled: Boolean(li),
      url: li ? `https://www.linkedin.com/oauth/v2/authorization?client_id=${li}&redirect_uri=${encodeURIComponent(appUrl + "/api/v1/auth/sso?provider=linkedin")}&response_type=code&scope=${encodeURIComponent("openid profile email")}` : null,
    },
  ];
}
