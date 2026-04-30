import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import open from "open";
import {
  buildPkce,
  buildGithubAuthUrl,
  waitForCallback,
  exchangeCodeForTokens,
} from "../lib/auth";
import { loadCredentials, clearCredentials, GITHUB_CLIENT_ID, API_URL } from "../lib/config";

const CALLBACK_PORT = 9876;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;

export function registerAuthCommands(program: Command) {
  const auth = program.command("auth").description("Authentication commands");

  auth
    .command("login")
    .alias("login") // also accessible as: insighta login
    .description("Log in with your GitHub account")
    .action(async () => {
      if (!GITHUB_CLIENT_ID) {
        console.error(chalk.red("Error: GITHUB_CLIENT_ID environment variable is not set."));
        console.error(chalk.gray("  export GITHUB_CLIENT_ID=<your-github-oauth-app-client-id>"));
        process.exit(1);
      }

      const existing = loadCredentials();
      if (existing) {
        console.log(chalk.yellow(`Already logged in as ${chalk.bold("@" + existing.username)}.`));
        console.log(chalk.gray("  Run: insighta auth logout  to switch accounts."));
        return;
      }

      const { codeVerifier, codeChallenge, state } = buildPkce();
      const authUrl = buildGithubAuthUrl(REDIRECT_URI, codeChallenge, state);

      console.log(chalk.bold("\nOpening GitHub in your browser..."));
      console.log(chalk.gray(`If nothing opens, visit:\n  ${authUrl}\n`));

      await open(authUrl);

      const spinner = ora("Waiting for GitHub authorisation...").start();

      try {
        const { code, state: returnedState } = await waitForCallback(CALLBACK_PORT);

        if (returnedState !== state) {
          spinner.fail("OAuth state mismatch — possible CSRF attempt.");
          process.exit(1);
        }

        spinner.text = "Exchanging code for tokens...";

        // Fetch the GitHub username to store alongside the tokens
        const whoamiRes = await fetch(`${API_URL}/api/users/me`, {
          headers: { "Content-Type": "application/json" },
        });
        // We don't have the token yet — use a temp exchange then fetch whoami
        const creds = await exchangeCodeForTokens(code, codeVerifier, REDIRECT_URI, "");

        // Now fetch the actual username
        const meRes = await fetch(`${API_URL}/api/users/me`, {
          headers: {
            Authorization: `Bearer ${creds.access_token}`,
            "X-API-Version": "1",
          },
        });

        void whoamiRes; // not used before token was available

        let username = "unknown";
        if (meRes.ok) {
          const me = await meRes.json() as { data?: { username?: string } };
          username = me.data?.username ?? "unknown";
          creds.username = username;
          // persist with correct username
          const { saveCredentials } = await import("../lib/config");
          saveCredentials(creds);
        }

        spinner.succeed(chalk.green(`Logged in as ${chalk.bold("@" + username)}`));
      } catch (err: unknown) {
        spinner.fail("Login failed: " + (err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });

  auth
    .command("logout")
    .description("Log out and remove stored credentials")
    .action(async () => {
      const creds = loadCredentials();
      if (!creds) {
        console.log(chalk.yellow("Not logged in."));
        return;
      }

      const spinner = ora("Logging out...").start();
      try {
        await fetch(`${API_URL}/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: creds.refresh_token }),
        });
      } catch {
        // best-effort server-side invalidation
      }

      clearCredentials();
      spinner.succeed(chalk.green(`Logged out.`));
    });

  auth
    .command("whoami")
    .description("Show the currently logged-in user")
    .action(() => {
      const creds = loadCredentials();
      if (!creds) {
        console.log(chalk.yellow("Not logged in. Run: insighta login"));
        return;
      }
      console.log(chalk.bold("@" + creds.username));
    });
}
