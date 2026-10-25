export function databaseMode(env = process.env) {
  const mode = env.DATABASE_MODE || "demo";
  if (!["demo", "mysql", "postgres"].includes(mode))
    throw new Error("DATABASE_MODE must be demo, mysql, or postgres.");
  return mode;
}
export function demoEnabled(env = process.env) {
  return (
    databaseMode(env) === "demo" &&
    env.DEMO_MODE !== "false" &&
    env.NODE_ENV !== "production"
  );
}
export function deploymentOrigins(env = process.env) {
  const values = [
    env.APP_ORIGIN,
    ...(env.APP_ORIGINS || "").split(","),
    ...[env.VERCEL_URL, env.VERCEL_PROJECT_PRODUCTION_URL]
      .filter(Boolean)
      .map((host) => `https://${host}`),
  ];
  if (env.NODE_ENV !== "production")
    values.push(
      "http://localhost:5173",
      `http://localhost:${env.PORT || 4000}`,
      `http://127.0.0.1:${env.PORT || 4000}`,
    );
  return new Set(
    values.filter(Boolean).map((value) => {
      let url;
      try {
        url = new URL(value.trim());
      } catch {
        throw new Error(
          "Application origins must be complete http:// or https:// URLs.",
        );
      }
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
      )
        throw new Error(
          "Application origins must contain only the protocol and host.",
        );
      return url.origin;
    }),
  );
}
export function assertCloudConfiguration(env = process.env) {
  if (env.VERCEL && databaseMode(env) === "demo")
    throw new Error(
      "Vercel requires a persistent hosted database. Set DATABASE_MODE=postgres or mysql and DATABASE_URL.",
    );
  if (
    env.NODE_ENV === "production" &&
    (env.DEMO_MODE === "true" || !deploymentOrigins(env).size)
  )
    throw new Error(
      "Production requires an application origin and demo accounts must be disabled.",
    );
  if (databaseMode(env) !== "demo" && !env.DATABASE_URL)
    throw new Error("DATABASE_URL is required for a hosted database.");
}
