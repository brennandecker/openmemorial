import path from "node:path";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  readJSON,
  saveJSON,
  validateAnswers,
  freeConfig,
  doctor,
  CloudflareClient,
  provision,
} from "./setup/core.mjs";
const root = path.resolve(fileURLToPath(new URL("..", import.meta.url))),
  directory = path.join(root, ".openmemorial");
const stateFile = path.join(directory, "state.json"),
  secretsFile = path.join(directory, "secrets.json"),
  configFile = path.join(directory, "wrangler.jsonc");
const command = process.argv[2] || "plan",
  apply = process.argv.includes("--apply");
async function run(file, args, env = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], {
      cwd: root,
      stdio: "inherit",
      shell: false,
      env: {
        ...process.env,
        WRANGLER_LOG_PATH: path.join(directory, "wrangler.log"),
        ...env,
      },
    });
    child.on("error", () =>
      reject(
        new Error("A local setup tool could not start. Run npm ci first."),
      ),
    );
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              "The command did not finish. Your saved setup is retained; fix the reported problem and retry.",
            ),
          ),
    );
  });
}
const wrangler = (args, env) =>
  run(path.join(root, "node_modules/wrangler/bin/wrangler.js"), args, env);
async function remoteDoctor(client, answers, state) {
  const app = (
    await client.request("GET", `/access/apps/${state.applicationId}`)
  ).result;
  if (
    app.domain !== `${state.hostname}/family` ||
    app.aud !== state.audience ||
    app.type !== "self_hosted"
  )
    throw new Error(
      "Family sign-in does not match this memorial. Run connect --apply before publishing.",
    );
  const policies = (
    await client.request("GET", `/access/apps/${state.applicationId}/policies`)
  ).result;
  if (
    policies.length !== 1 ||
    policies[0].id !== state.policyId ||
    policies[0].decision !== "allow" ||
    policies[0].require?.length ||
    policies[0].exclude?.length ||
    policies[0].include.some((rule) => !rule.email?.email)
  )
    throw new Error(
      "Unexpected family policies. Setup will not publish with broader or conflicting access.",
    );
  const emails = policies[0].include
    .map((rule) => rule.email.email.toLowerCase())
    .sort();
  if (JSON.stringify(emails) !== JSON.stringify([...answers.managers].sort()))
    throw new Error(
      "Family manager access is out of sync. Run connect --apply.",
    );
  const widget = (
    await client.request("GET", `/challenges/widgets/${state.widgetId}`)
  ).result;
  if (
    widget.mode !== "managed" ||
    widget.domains.length !== 1 ||
    widget.domains[0] !== state.hostname
  )
    throw new Error("Bot verification is configured for a different address.");
}
async function health(state) {
  const origin = `https://${state.hostname}`;
  const checks = [];
  const inspect = async (resource, test) => {
    const response = await fetch(origin + resource, {
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    });
    const ok = await test(response);
    checks.push({ ok, path: resource });
  };
  await inspect("/", (r) => r.status === 200);
  await inspect(
    "/api/wall",
    async (r) => r.ok && Array.isArray((await r.json()).items),
  );
  await inspect("/api/config", async (r) => {
    if (!r.ok) return false;
    const c = await r.json();
    return (
      c.features?.photoUploads === false &&
      c.features?.shareMemory === state.notes
    );
  });
  await inspect("/family/api/content/curated", (r) =>
    [302, 401, 403].includes(r.status),
  );
  return checks;
}
async function main() {
  if (command === "help" || process.argv.includes("--help")) {
    console.log(
      "OpenMemorial Cloudflare setup\n  plan                 Review a local-only deployment plan\n  connect --apply      Provision the free profile (requires account ID and CLOUDFLARE_API_TOKEN)\n  doctor [--remote]    Check readiness; --remote also checks Access and Turnstile\n  publish --apply      Build, migrate, and publish the reviewed memorial\n  verify               Check the live site without submitting any memories\nNever paste API tokens into chat. Set CLOUDFLARE_API_TOKEN privately in your terminal.",
    );
    return;
  }
  if (!["plan", "connect", "doctor", "publish", "verify"].includes(command))
    throw new Error(
      "Unknown setup command. Run npm run setup:cloudflare -- help.",
    );
  const answers = validateAnswers(
    await readJSON(path.join(directory, "answers.json")),
  );
  const state = await readJSON(stateFile, {}),
    secrets = await readJSON(secretsFile, {}),
    base = await readJSON(path.join(root, "wrangler.jsonc"));
  const config = freeConfig(base, answers, state);
  if (command === "plan") {
    console.log(
      `Memorial: ${answers.name}\nCloudflare Worker: ${answers.workerName}\nAccount: ${answers.accountId || "not selected yet"}\nAddress: ${state.hostname || "free workers.dev address, assigned when connected"}\nPhotographs: ${answers.photos.length}, prepared and bundled locally\nVisitor notes: ${answers.notes ? "private until approved by " + answers.managers.length + " family manager(s)" : "off"}\n\nFree profile: Workers static assets + D1${answers.notes ? " + Turnstile + Cloudflare Access" : ""}.\nNo R2 subscription, paid image storage, outgoing email service, or domain purchase is enabled.\nCloudflare’s free-plan usage limits still apply. Open-source licensing does not make third-party services unlimited.\n\nNothing was changed remotely. Next: npm run setup:cloudflare -- connect --apply`,
    );
    return;
  }
  if (command === "verify") {
    if (!state.published)
      throw new Error("This setup has not confirmed a deployment yet.");
    const checks = await health(state);
    checks.forEach((c) => console.log(`${c.ok ? "OK" : "CHECK"} ${c.path}`));
    if (checks.some((c) => !c.ok))
      throw new Error(
        "A live check failed. Check your deployment before announcing the site.",
      );
    console.log(`Live checks passed: https://${state.hostname}/`);
    return;
  }
  let client;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (
    command === "connect" ||
    process.argv.includes("--remote") ||
    command === "publish"
  ) {
    if (!token)
      throw new Error(
        "Set CLOUDFLARE_API_TOKEN privately in your terminal (never in chat). SETUP.md lists the exact account permissions.",
      );
    client = new CloudflareClient(answers.accountId, token);
  }
  if (command === "connect") {
    if (!apply)
      throw new Error(
        "Review the plan first. To create resources, run npm run setup:cloudflare -- connect --apply.",
      );
    const persist = async (s, k) => {
      await saveJSON(stateFile, s);
      await saveJSON(secretsFile, k);
    };
    await provision(client, answers, state, secrets, persist);
    state.audience = secrets.ACCESS_AUD;
    state.notes = answers.notes;
    await persist(state, secrets);
    await saveJSON(configFile, freeConfig(base, answers, state));
    console.log(
      `Connected ${answers.workerName} in account ${answers.accountId}.\nThe database, ${answers.notes ? "family sign-in, and bot checks are configured" : "free site resources are configured"}. No site was published.\nNext: npm run setup:cloudflare -- doctor --remote`,
    );
    return;
  }
  const savedConfig = await readJSON(configFile, config),
    checks = doctor(answers, savedConfig, state, secrets);
  checks.forEach((check) =>
    console.log(`${check.ok ? "OK" : "NEEDS SETUP"} ${check.label}`),
  );
  if (checks.some((c) => !c.ok))
    throw new Error("Complete the items marked NEEDS SETUP before publishing.");
  if (client && answers.notes) await remoteDoctor(client, answers, state);
  if (command === "doctor") {
    console.log(
      `Ready to build${client ? " and publish after your review" : ""}. Free-tier limits and optional feature costs are explained in COSTS.md.`,
    );
    return;
  }
  if (!apply)
    throw new Error(
      "Nothing was published. Review your preview, then run npm run setup:cloudflare -- publish --apply.",
    );
  // The API token belongs only to the local setup process. It is not part of the app secrets.
  const runtimeKeys = [
    "ACCESS_AUD",
    "ACCESS_TEAM_DOMAIN",
    "MODERATOR_EMAILS",
    "TURNSTILE_SECRET",
    "TURNSTILE_SITEKEY",
    "TURNSTILE_HOSTNAMES",
  ];
  if (Object.keys(secrets).some((key) => !runtimeKeys.includes(key)))
    throw new Error(
      "The runtime secret file contains an unexpected key. Only the six application secrets may be uploaded; account tokens stay in the process environment.",
    );
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await run(path.join(root, "node_modules/typescript/bin/tsc"), ["--noEmit"]);
  await run(path.join(root, "node_modules/vite/bin/vite.js"), ["build"]);
  await wrangler(
    ["d1", "migrations", "apply", "NOTES", "--remote", "--config", configFile],
    { CI: "true", CLOUDFLARE_ACCOUNT_ID: answers.accountId },
  );
  state.publishAttempted = true;
  await saveJSON(stateFile, state);
  await wrangler(
    [
      "deploy",
      "--config",
      configFile,
      ...(answers.notes ? ["--secrets-file", secretsFile] : []),
    ],
    { CI: "true", CLOUDFLARE_ACCOUNT_ID: answers.accountId },
  );
  state.published = true;
  state.notes = answers.notes;
  state.publishedAt = new Date().toISOString();
  await saveJSON(stateFile, state);
  const verification = await health(state);
  verification.forEach((c) =>
    console.log(`${c.ok ? "OK" : "CHECK"} ${c.path}`),
  );
  if (verification.some((c) => !c.ok))
    throw new Error(
      "Deployment finished, but a live check is not ready. Run npm run setup:cloudflare -- verify before sharing the address.",
    );
  console.log(
    `Published and checked: https://${state.hostname}/\nFamily sign-in: https://${state.hostname}/login\nPlease sign in once with an invited family email to complete the human sign-in check. Email codes are never read by setup.`,
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
