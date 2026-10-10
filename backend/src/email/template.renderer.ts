import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Resolved from this module's own location, not from process.cwd(). The file
// sits at <dist|src>/email/templates/password-reset.html in both trees —
// `nest-cli.json` copies `email/templates/**` into `dist/` as an asset — so
// the relative path is identical in development and in the built image.
const TEMPLATE_DIR = join(dirname(fileURLToPath(import.meta.url)), "templates");

/**
 * Renders an HTML template from `src/email/templates`.
 *
 * Shared by every transport that produces HTML. It lived inside
 * `ResendEmailService`, which meant adding the SMTP transport would have meant
 * copying this method — and the regex subtlety below with it.
 */
export function renderTemplate(
  name: string,
  variables: Record<string, string>,
): string {
  const template = readFileSync(join(TEMPLATE_DIR, `${name}.html`), "utf-8");
  // Placeholder substitution via a function replacer rather than a string
  // pattern, so substituted values are inserted literally — a reset URL
  // containing `$&` or `$1` must not be expanded as a `String.replace` pattern.
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in variables ? variables[key] : match,
  );
}

export function renderPasswordReset(resetUrl: string, expiresInHours: number) {
  return renderTemplate("password-reset", {
    RESET_URL: resetUrl,
    EXPIRY_HOURS: String(expiresInHours),
  });
}
