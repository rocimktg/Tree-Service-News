import postgres from "postgres";

// Railway sets DATABASE_URL automatically from the linked Supabase integration.
// For local dev, set DATABASE_URL in .env to the Supabase local connection string.
export const sql = postgres(import.meta.env.DATABASE_URL, { ssl: "require" });
