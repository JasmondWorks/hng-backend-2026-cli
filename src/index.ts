#!/usr/bin/env node
import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth";
import { registerProfileCommands } from "./commands/profiles";
import { loadCredentials } from "./lib/config";

const program = new Command();

program
  .name("insighta")
  .description("Insighta Labs CLI — manage profiles and auth from your terminal")
  .version("1.0.0");

// Top-level shortcuts so both styles work:
//   insighta login      (shortcut)
//   insighta auth login (explicit)
program
  .command("login")
  .description("Log in with your GitHub account")
  .action(async () => {
    const { registerAuthCommands: reg } = await import("./commands/auth");
    const tmp = new Command();
    reg(tmp);
    await tmp.parseAsync(["node", "insighta", "auth", "login"]);
  });

program
  .command("logout")
  .description("Log out and remove stored credentials")
  .action(async () => {
    const { registerAuthCommands: reg } = await import("./commands/auth");
    const tmp = new Command();
    reg(tmp);
    await tmp.parseAsync(["node", "insighta", "auth", "logout"]);
  });

program
  .command("whoami")
  .description("Show the currently logged-in user")
  .action(() => {
    const creds = loadCredentials();
    if (!creds) {
      console.log("Not logged in. Run: insighta login");
      return;
    }
    console.log("@" + creds.username);
  });

registerAuthCommands(program);
registerProfileCommands(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
