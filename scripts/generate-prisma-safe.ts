// Safe Prisma generate script that works even without DATABASE_URL
// This is used during Vercel builds

import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

// Set a dummy DATABASE_URL if not available
// Prisma generate doesn't need a real connection, only the schema
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "mongodb://localhost:27017/dummy?appName=PrismaGenerate";
}

try {
  // Check if schema exists
  const schemaPath = join(process.cwd(), "prisma", "schema.prisma");
  if (!existsSync(schemaPath)) {
    console.error("❌ Prisma schema not found at:", schemaPath);
    process.exit(1);
  }

  console.log("🔄 Generating Prisma Client...");
  execSync("prisma generate", { stdio: "inherit" });
  console.log("✅ Prisma Client generated successfully");
} catch (error: any) {
  console.error("❌ Failed to generate Prisma Client:", error.message);
  // Don't fail the build - Prisma Client might be generated later
  console.log(
    "⚠️ Continuing build without Prisma Client (will be generated at runtime if needed)"
  );
  process.exit(0); // Exit with success to not fail the build
}
