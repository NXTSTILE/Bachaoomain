const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;

// Set NEXT_PUBLIC_SITE_URL to the final HTTPS domain before the production build.
export const siteUrl = new URL(
  configuredUrl || (vercelHost ? `https://${vercelHost}` : "http://localhost:3000"),
).origin;

export const isIndexable =
  process.env.VERCEL_ENV !== "preview" && siteUrl.startsWith("https://");

export const siteDescription =
  "Your college notice board and private help from appointed Helpers. Connect about placements, classes, projects and campus life — starting with Centurion University.";
