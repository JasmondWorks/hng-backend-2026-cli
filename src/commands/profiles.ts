import fs from "fs";
import path from "path";
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { requireAuth } from "../lib/auth";
import { apiRequest } from "../lib/api";
import { printProfileTable, printProfileDetail, printPaginationInfo } from "../lib/display";
import { Profile, PaginatedResponse } from "../types";

export function registerProfileCommands(program: Command) {
  const profiles = program
    .command("profiles")
    .description("Manage and query profiles");

  // ── list ──────────────────────────────────────────────────────────────────
  profiles
    .command("list")
    .description("List profiles with optional filters")
    .option("--gender <gender>", "Filter by gender (male|female)")
    .option("--country <code>", "Filter by country ISO code (e.g. NG)")
    .option("--age-group <group>", "Filter by age group (child|teenager|adult|senior)")
    .option("--min-age <n>", "Minimum age")
    .option("--max-age <n>", "Maximum age")
    .option("--sort-by <field>", "Sort field (age|created_at|gender_probability)")
    .option("--order <dir>", "Sort direction (asc|desc)", "desc")
    .option("--page <n>", "Page number", "1")
    .option("--limit <n>", "Results per page (max 50)", "10")
    .action(async (opts) => {
      const spinner = ora("Fetching profiles...").start();
      try {
        const creds = await requireAuth();
        const res = await apiRequest<PaginatedResponse<Profile>>(creds, "/profiles", {
          params: {
            gender: opts.gender,
            country_id: opts.country,
            age_group: opts.ageGroup,
            min_age: opts.minAge,
            max_age: opts.maxAge,
            sort_by: opts.sortBy,
            order: opts.order,
            page: opts.page,
            limit: opts.limit,
          },
        });
        spinner.stop();
        printProfileTable(res.data);
        printPaginationInfo(res.page, res.limit, res.total, res.total_pages);
      } catch (err: unknown) {
        spinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // ── get ───────────────────────────────────────────────────────────────────
  profiles
    .command("get <id>")
    .description("Get a single profile by UUID")
    .action(async (id: string) => {
      const spinner = ora("Fetching profile...").start();
      try {
        const creds = await requireAuth();
        const res = await apiRequest<{ status: string; data: Profile }>(
          creds,
          `/profiles/${id}`
        );
        spinner.stop();
        printProfileDetail(res.data);
      } catch (err: unknown) {
        spinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // ── search ────────────────────────────────────────────────────────────────
  profiles
    .command("search <query>")
    .description('Natural language search (e.g. "young males from nigeria")')
    .option("--page <n>", "Page number", "1")
    .option("--limit <n>", "Results per page", "10")
    .action(async (query: string, opts) => {
      const spinner = ora("Searching...").start();
      try {
        const creds = await requireAuth();
        const res = await apiRequest<PaginatedResponse<Profile>>(creds, "/profiles/search", {
          params: { q: query, page: opts.page, limit: opts.limit },
        });
        spinner.stop();
        printProfileTable(res.data);
        printPaginationInfo(res.page, res.limit, res.total, res.total_pages);
      } catch (err: unknown) {
        spinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // ── create ────────────────────────────────────────────────────────────────
  profiles
    .command("create")
    .description("Create a new profile (admin only)")
    .requiredOption("--name <name>", "Person's full name")
    .action(async (opts) => {
      const spinner = ora(`Creating profile for "${opts.name}"...`).start();
      try {
        const creds = await requireAuth();
        const res = await apiRequest<{ status: string; data: Profile }>(
          creds,
          "/profiles",
          { method: "POST", body: { name: opts.name } }
        );
        spinner.succeed(chalk.green("Profile created."));
        printProfileDetail(res.data);
      } catch (err: unknown) {
        spinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // ── export ────────────────────────────────────────────────────────────────
  profiles
    .command("export")
    .description("Export profiles to a CSV file")
    .requiredOption("--format <fmt>", "Export format (csv)")
    .option("--gender <gender>", "Filter by gender")
    .option("--country <code>", "Filter by country ISO code")
    .option("--age-group <group>", "Filter by age group")
    .option("--min-age <n>", "Minimum age")
    .option("--max-age <n>", "Maximum age")
    .action(async (opts) => {
      if (opts.format !== "csv") {
        console.error(chalk.red('Only --format csv is supported.'));
        process.exit(1);
      }

      const spinner = ora("Exporting profiles...").start();
      try {
        const creds = await requireAuth();

        const params = new URLSearchParams();
        if (opts.gender) params.set("gender", opts.gender);
        if (opts.country) params.set("country_id", opts.country);
        if (opts.ageGroup) params.set("age_group", opts.ageGroup);
        if (opts.minAge) params.set("min_age", opts.minAge);
        if (opts.maxAge) params.set("max_age", opts.maxAge);

        const { API_URL } = await import("../lib/config");
        const qs = params.toString();
        const url = `${API_URL}/api/profiles/export?format=csv${qs ? "&" + qs : ""}`;

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${creds.access_token}`,
            "X-API-Version": "1",
          },
        });

        if (!res.ok) {
          throw new Error(`Export failed: ${res.status}`);
        }

        const csv = await res.text();
        const filename = `profiles_${Date.now()}.csv`;
        const filepath = path.join(process.cwd(), filename);
        fs.writeFileSync(filepath, csv, "utf-8");

        spinner.succeed(chalk.green(`Exported to ${chalk.bold(filepath)}`));
      } catch (err: unknown) {
        spinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
