/**
 * Env bootstrap. Imported before anything else in src/index.ts so the project's
 * .env overrides any shell-level env vars leaking in from other tooling
 * (e.g. Claude Desktop setting ANTHROPIC_BASE_URL in the shell environment).
 */
import dotenv from 'dotenv';
dotenv.config({ override: true });
