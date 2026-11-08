import { readFile, writeFile, mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
export const privateDirectory = ".openmemorial";
export const accountIdPattern = /^[a-f0-9]{32}$/i;
export const emailPattern =
  /^[a-z0-9.!#$%&'+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;
export async function readJSON(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT" && arguments.length > 1) return fallback;
    throw new Error(
      `Cannot read ${path.basename(file)}. Check that it contains valid JSON.`,
    );
  }
}
export async function saveJSON(file, value) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = file + ".new";
  await writeFile(temp, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  await rename(temp, file);
}
export function text(value, label, max = 120, optional = false) {
  if (
    typeof value !== "string" ||
    (!optional && !value.trim()) ||
    value.trim().length > max ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    throw new Error(`Please check ${label}.`);
  return value.trim();
}
export function validDate(value) {
  if (!value) return true;
  if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(value) || value.slice(0, 4) === "0000")
    return false;
  const day =
    value.length === 4
      ? value + "-01-01"
      : value.length === 7
        ? value + "-01"
        : value;
  return (
    !Number.isNaN(Date.parse(day + "T12:00:00Z")) &&
    new Date(day + "T12:00:00Z").toISOString().slice(0, 10) === day
  );
}
export function slug(value) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
export const stableId = (prefix, value) =>
  prefix +
  "-" +
  createHash("sha256")
    .update(value.normalize("NFKC").trim().toLowerCase())
    .digest("hex")
    .slice(0, 16);
export function validateAnswers(input) {
  if (!input || typeof input !== "object")
    throw new Error("Please start with the setup questions.");
  const name = text(input.name, "the person’s name");
  const workerName = text(
    input.workerName || ("remembering-" + slug(name)).slice(0, 55),
    "the site name",
    60,
  );
  if (!/^[a-z][a-z0-9-]{2,59}$/.test(workerName))
    throw new Error(
      "The site name needs 3–60 lowercase letters, numbers, or hyphens, starting with a letter.",
    );
  const birth = input.birth || "",
    death = input.death || "";
  if (
    !validDate(birth) ||
    !validDate(death) ||
    [birth, death].some((v) => v && v.length !== 10) ||
    (birth && death && birth > death)
  )
    throw new Error("Life dates must be YYYY-MM-DD, or left blank.");
  const timeZone = input.timeZone || "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone });
  } catch {
    throw new Error("Please choose a valid home time zone.");
  }
  const privacyEmail = text(
    input.privacyEmail,
    "the public contact email",
    254,
  );
  if (!emailPattern.test(privacyEmail) || privacyEmail.endsWith("@example.com"))
    throw new Error("Add a working public privacy/removal email.");
  if (
    !Array.isArray(input.managers) ||
    input.managers.length > 10 ||
    input.managers.some(
      (v) => typeof v !== "string" || !emailPattern.test(v.trim()),
    )
  )
    throw new Error("Use up to ten exact family manager email addresses.");
  const managers = [
      ...new Set(input.managers.map((v) => v.trim().toLowerCase())),
    ],
    notes = input.notes !== false;
  if (notes && !managers.length)
    throw new Error(
      "Choose at least one family manager before enabling visitor notes.",
    );
  const accountId = input.accountId || "";
  if (accountId && !accountIdPattern.test(accountId))
    throw new Error(
      "The Cloudflare account ID must contain 32 hexadecimal characters.",
    );
  if (input.profile && input.profile !== "free")
    throw new Error(
      "The guided installer supports the free profile only. Optional services are configured separately.",
    );
  const photos = input.photos || [];
  if (!Array.isArray(photos) || photos.length > 200)
    throw new Error("Start with up to 200 photographs.");
  const normalizedPhotos = photos.map((photo, index) => {
    if (!photo || typeof photo !== "object")
      throw new Error(`Please check photo ${index + 1}.`);
    const file = text(photo.file, `photo ${index + 1}’s file`, 4096),
      caption = text(
        photo.caption || "A moment to remember",
        "the photo caption",
        180,
      );
    const date = photo.date || "";
    if (!validDate(date))
      throw new Error(`Please check photo ${index + 1}’s confirmed date.`);
    const people = photo.people || [];
    if (!Array.isArray(people) || people.length > 20)
      throw new Error("Use up to 20 people per photograph.");
    const message = photo.message || "";
    if (
      typeof message !== "string" ||
      message.length > 1000 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(message)
    )
      throw new Error("Please check the note on the photo’s back.");
    return {
      file,
      caption,
      date,
      dateSource: photo.dateSource === "camera" ? "camera" : "family",
      people: people.map((p) => text(p, "a person’s name", 80)),
      message,
      city: text(photo.city || "", "the city", 80, true),
      state: text(photo.state || "", "the state/region", 80, true),
      country: text(photo.country || "", "the country", 80, true),
    };
  });
  const portrait = input.portrait === undefined ? null : input.portrait;
  if (
    portrait !== null &&
    (!Number.isInteger(portrait) || portrait < 0 || portrait >= photos.length)
  )
    throw new Error(
      "The header photo must refer to one of your photographs, starting at 0.",
    );
  return {
    version: 1,
    profile: "free",
    name,
    workerName,
    birth,
    death,
    timeZone,
    privacyEmail,
    managers,
    notes,
    accountId,
    photos: normalizedPhotos,
    portrait,
  };
}
export function freeConfig(base, answers, state = {}) {
  const allowed = [
    "name",
    "compatibility_date",
    "assets",
    "observability",
    "main",
    "ratelimits",
  ];
  const config = structuredClone(
    Object.fromEntries(
      Object.entries(base).filter(([key]) => allowed.includes(key)),
    ),
  );
  config.name = answers.workerName;
  config.workers_dev = true;
  delete config.routes;
  delete config.r2_buckets;
  delete config.images;
  delete config.send_email;
  delete config.secrets;
  config.account_id = answers.accountId || state.accountId || undefined;
  config.main = "../src/videoWorker.ts";
  config.assets.directory = "../dist";
  config.vars = {
    SUBMISSIONS_ENABLED: answers.notes ? "true" : "false",
    PHOTO_UPLOADS_ENABLED: "false",
  };
  config.d1_databases = [
    {
      binding: "NOTES",
      database_name: answers.workerName + "-notes",
      ...(state.databaseId ? { database_id: state.databaseId } : {}),
      migrations_dir: "../migrations",
    },
  ];
  return config;
}
export function doctor(answers, config, state, secrets) {
  const checks = [];
  const add = (ok, label) => checks.push({ ok: !!ok, label });
  add(
    answers.name && emailPattern.test(answers.privacyEmail),
    "Memorial name and public privacy contact",
  );
  add(accountIdPattern.test(answers.accountId), "Cloudflare account selected");
  add(
    state.accountId === answers.accountId &&
      state.workerName === answers.workerName,
    "Saved resources belong to this account and memorial",
  );
  add(
    state.databaseId &&
      config.d1_databases?.[0]?.database_id === state.databaseId,
    "Notes database connected",
  );
  add(
    !config.r2_buckets?.length &&
      !config.images &&
      !config.send_email?.length &&
      !config.routes?.length,
    "Free profile: no R2, image service, outgoing email, or purchased domain",
  );
  add(
    state.hostname === `${answers.workerName}.${state.subdomain}.workers.dev`,
    "Free workers.dev address",
  );
  if (answers.notes) {
    add(
      state.applicationId &&
        secrets.ACCESS_AUD &&
        /^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(
          secrets.ACCESS_TEAM_DOMAIN || "",
        ),
      "Private family sign-in configured",
    );
    add(
      secrets.MODERATOR_EMAILS === answers.managers.join(","),
      "Exact family manager allowlist synchronized",
    );
    add(
      secrets.TURNSTILE_SECRET &&
        secrets.TURNSTILE_SITEKEY &&
        !secrets.TURNSTILE_SITEKEY.startsWith("1x") &&
        secrets.TURNSTILE_HOSTNAMES === state.hostname,
      "Production bot verification for this hostname",
    );
  }
  add(
    config.name === answers.workerName &&
      config.account_id === answers.accountId,
    "Deployment targets the reviewed memorial",
  );
  const allowedKeys = [
    "name",
    "compatibility_date",
    "assets",
    "observability",
    "main",
    "ratelimits",
    "workers_dev",
    "account_id",
    "vars",
    "d1_databases",
  ];
  add(
    Object.keys(config).every((key) => allowedKeys.includes(key)) &&
      config.main === "../src/videoWorker.ts" &&
      config.assets?.directory === "../dist" &&
      config.assets?.binding === "ASSETS" &&
      Object.keys(config.vars || {}).every((key) =>
        ["SUBMISSIONS_ENABLED", "PHOTO_UPLOADS_ENABLED"].includes(key),
      ) &&
      config.vars?.PHOTO_UPLOADS_ENABLED === "false" &&
      config.vars?.SUBMISSIONS_ENABLED === (answers.notes ? "true" : "false"),
    "Only the reviewed source, public assets, and free-profile settings are deployed",
  );
  return checks;
}
export class CloudflareClient {
  constructor(accountId, token, fetcher = fetch) {
    if (!accountIdPattern.test(accountId) || !token)
      throw new Error("Connect your Cloudflare account first.");
    this.accountId = accountId;
    this.token = token;
    this.fetcher = fetcher;
  }
  async request(method, resource, body) {
    if (!resource.startsWith("/"))
      throw new Error("Invalid Cloudflare resource.");
    const response = await this.fetcher(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}${resource}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(30000),
      },
    );
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error(
        `Cloudflare returned an unexpected response (${response.status}). Please retry.`,
      );
    }
    if (!response.ok || result.success !== true) {
      const error = new Error(
        `Cloudflare ${method} ${resource.split("?")[0]} failed (${response.status}). Check the account and token permissions in SETUP.md.`,
      );
      error.status = response.status;
      throw error;
    }
    return result;
  }
  async list(resource) {
    if (resource === "/workers/scripts")
      return (await this.request("GET", resource)).result;
    const values = [];
    for (let page = 1; page <= 100; page++) {
      const r = await this.request(
        "GET",
        `${resource}${resource.includes("?") ? "&" : "?"}page=${page}&per_page=100`,
      );
      values.push(...r.result);
      if (
        !r.result_info ||
        page >= r.result_info.total_pages ||
        !r.result.length ||
        (!Number.isFinite(r.result_info.total_pages) && r.result.length < 100)
      )
        return values;
    }
    throw new Error(
      "Too many existing resources. Please use a smaller dedicated account.",
    );
  }
}
export async function provision(client, answers, state, secrets, persist) {
  if (
    state.accountId &&
    (state.accountId !== answers.accountId ||
      state.workerName !== answers.workerName)
  )
    throw new Error(
      "This folder is connected to a different memorial. Use a new folder to avoid changing existing resources.",
    );
  state.accountId = answers.accountId;
  state.workerName = answers.workerName;
  const subdomain = (await client.request("GET", "/workers/subdomain")).result
    .subdomain;
  if (!subdomain)
    throw new Error(
      "Choose your free workers.dev subdomain in the Cloudflare dashboard, then retry.",
    );
  state.subdomain = subdomain;
  state.hostname = `${answers.workerName}.${subdomain}.workers.dev`;
  // Do not take over an existing Worker when this folder has no record of deploying it.
  if (!state.published && !state.publishAttempted) {
    const workers = await client.list("/workers/scripts");
    if (workers.some((w) => w.id === answers.workerName))
      throw new Error(
        "That Worker name already exists. Choose a new site name; setup will not overwrite it.",
      );
  }
  let organization;
  if (answers.notes) {
    try {
      organization = (await client.request("GET", "/access/organizations"))
        .result;
    } catch (error) {
      if (error.status === 404)
        throw new Error(
          "Open Cloudflare Zero Trust, complete its Free-plan onboarding, then rerun this step. No paid plan is needed.",
        );
      throw error;
    }
    if (!organization?.auth_domain)
      throw new Error(
        "Finish Cloudflare Zero Trust Free onboarding, then retry.",
      );
  }
  await persist(state, secrets);
  if (!state.databaseId) {
    const existing = await client.list("/d1/database");
    if (existing.some((db) => db.name === answers.workerName + "-notes"))
      throw new Error(
        "A database with this memorial’s name already exists. Restore its saved setup state or choose a different site name.",
      );
    const db = (
      await client.request("POST", "/d1/database", {
        name: answers.workerName + "-notes",
      })
    ).result;
    state.databaseId = db.uuid;
    await persist(state, secrets);
  }
  if (answers.notes) {
    if (!state.widgetId) {
      const widget = (
        await client.request("POST", "/challenges/widgets", {
          name: `${answers.workerName} memories`,
          mode: "managed",
          domains: [state.hostname],
        })
      ).result;
      state.widgetId = widget.sitekey;
      secrets.TURNSTILE_SITEKEY = widget.sitekey;
      secrets.TURNSTILE_SECRET = widget.secret;
      await persist(state, secrets);
    }
    if (!secrets.TURNSTILE_SECRET)
      throw new Error(
        "The saved Turnstile secret is missing. Restore .openmemorial/secrets.json; do not paste secrets into chat.",
      );
    secrets.TURNSTILE_HOSTNAMES = state.hostname;
    if (!state.identityProviderId) {
      const providers = await client.list("/access/identity_providers");
      const provider =
        providers.find((p) => p.type === "onetimepin") ||
        (
          await client.request("POST", "/access/identity_providers", {
            name: "Email sign-in",
            type: "onetimepin",
            config: {},
          })
        ).result;
      state.identityProviderId = provider.id;
      await persist(state, secrets);
    }
    const policy = {
      name: `${answers.workerName} family`,
      decision: "allow",
      include: answers.managers.map((email) => ({ email: { email } })),
      exclude: [],
      require: [],
      session_duration: "24h",
    };
    if (state.policyId) {
      const current = (
        await client.request("GET", `/access/policies/${state.policyId}`)
      ).result;
      if (current.name !== policy.name || current.app_count > 1)
        throw new Error(
          "The family policy is shared or has changed. Setup will not modify it.",
        );
      await client.request("PUT", `/access/policies/${state.policyId}`, policy);
    } else {
      state.policyId = (
        await client.request("POST", "/access/policies", policy)
      ).result.id;
      await persist(state, secrets);
    }
    const app = {
      name: `${answers.workerName} family`,
      type: "self_hosted",
      domain: `${state.hostname}/family`,
      session_duration: "24h",
      allowed_idps: [state.identityProviderId],
      auto_redirect_to_identity: true,
      policies: [{ id: state.policyId, precedence: 1 }],
    };
    let application;
    if (state.applicationId) {
      const current = (
        await client.request("GET", `/access/apps/${state.applicationId}`)
      ).result;
      if (current.domain !== app.domain || current.name !== app.name)
        throw new Error(
          "The family sign-in target changed. Setup will not modify it.",
        );
      application = (
        await client.request("PUT", `/access/apps/${state.applicationId}`, app)
      ).result;
    } else {
      const apps = await client.list("/access/apps");
      if (apps.some((a) => a.domain === app.domain))
        throw new Error(
          "This family address is already protected by another application. Restore your saved setup state.",
        );
      application = (await client.request("POST", "/access/apps", app)).result;
      state.applicationId = application.id;
    }
    secrets.ACCESS_AUD = application.aud;
    secrets.ACCESS_TEAM_DOMAIN = `https://${organization.auth_domain}`;
    secrets.MODERATOR_EMAILS = answers.managers.join(",");
    if (!secrets.ACCESS_AUD || !secrets.TURNSTILE_SECRET)
      throw new Error(
        "Cloudflare did not return the required setup keys. Nothing will be published.",
      );
    await persist(state, secrets);
  }
  return { state, secrets };
}
