type FeatureSettings = Partial<
  Pick<
    CloudflareEnv,
    | "NOTES"
    | "MEMORY_PHOTOS"
    | "IMAGES"
    | "ACCESS_AUD"
    | "ACCESS_TEAM_DOMAIN"
    | "MODERATOR_EMAILS"
    | "TURNSTILE_SITEKEY"
    | "TURNSTILE_SECRET"
    | "TURNSTILE_HOSTNAMES"
  >
> & { SUBMISSIONS_ENABLED?: string; PHOTO_UPLOADS_ENABLED?: string };
/** Unconfigured templates stay read-only; optional storage is never assumed to exist. */
export function runtimeFeatures(env: FeatureSettings) {
  const shareMemory =
    env.SUBMISSIONS_ENABLED !== "false" &&
    !!(
      env.NOTES &&
      env.ACCESS_AUD &&
      env.ACCESS_TEAM_DOMAIN &&
      env.MODERATOR_EMAILS &&
      env.TURNSTILE_SITEKEY &&
      env.TURNSTILE_SECRET &&
      env.TURNSTILE_HOSTNAMES
    );
  return {
    shareMemory,
    photoUploads:
      shareMemory &&
      env.PHOTO_UPLOADS_ENABLED !== "false" &&
      !!(env.MEMORY_PHOTOS && env.IMAGES),
  };
}
