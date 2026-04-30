import Table from "cli-table3";
import chalk from "chalk";
import { Profile } from "../types";

export function printProfileTable(profiles: Profile[]) {
  if (profiles.length === 0) {
    console.log(chalk.yellow("No profiles found."));
    return;
  }

  const table = new Table({
    head: [
      chalk.cyan("ID"),
      chalk.cyan("Name"),
      chalk.cyan("Gender"),
      chalk.cyan("Age"),
      chalk.cyan("Age Group"),
      chalk.cyan("Country"),
    ],
    colWidths: [38, 22, 8, 6, 12, 8],
    wordWrap: true,
  });

  for (const p of profiles) {
    table.push([
      p.id,
      p.name,
      p.gender ?? "—",
      String(p.age),
      p.age_group,
      p.country_id,
    ]);
  }

  console.log(table.toString());
}

export function printProfileDetail(p: Profile) {
  const table = new Table({ style: { head: [] } });

  table.push(
    [chalk.bold("ID"), p.id],
    [chalk.bold("Name"), p.name],
    [chalk.bold("Gender"), p.gender ?? "—"],
    [chalk.bold("Gender Probability"), String(p.gender_probability)],
    [chalk.bold("Age"), String(p.age)],
    [chalk.bold("Age Group"), p.age_group],
    [chalk.bold("Country"), `${p.country_name} (${p.country_id})`],
    [chalk.bold("Country Probability"), String(p.country_probability)],
    [chalk.bold("Created At"), new Date(p.created_at).toLocaleString()]
  );

  console.log(table.toString());
}

export function printPaginationInfo(page: number, limit: number, total: number, totalPages: number) {
  console.log(
    chalk.gray(`\nPage ${page}/${totalPages} · ${total} total results · limit ${limit}`)
  );
}
