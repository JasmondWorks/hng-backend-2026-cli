import fs from "fs";
import path from "path";
import os from "os";
import { Credentials } from "../types";

const CONFIG_DIR = path.join(os.homedir(), ".insighta");
const CREDENTIALS_FILE = path.join(CONFIG_DIR, "credentials.json");

export const API_URL =
  process.env.INSIGHTA_API_URL ?? "https://hng-backend-2026.vercel.app";

export const GITHUB_CLIENT_ID =
  process.env.GITHUB_CLIENT_ID ?? "";

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function saveCredentials(creds: Credentials) {
  ensureConfigDir();
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), "utf-8");
}

export function loadCredentials(): Credentials | null {
  if (!fs.existsSync(CREDENTIALS_FILE)) return null;
  try {
    const raw = fs.readFileSync(CREDENTIALS_FILE, "utf-8");
    return JSON.parse(raw) as Credentials;
  } catch {
    return null;
  }
}

export function clearCredentials() {
  if (fs.existsSync(CREDENTIALS_FILE)) {
    fs.unlinkSync(CREDENTIALS_FILE);
  }
}
