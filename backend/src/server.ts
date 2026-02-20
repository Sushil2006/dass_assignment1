import fs from "node:fs";
import path from "node:path";
import { app } from "./app";
import { env } from "./config/env";
import { connectDb } from "./db/client";
import { ensureDbIndexes } from "./db/indexes";
import { seedFirstAdmin } from "./startup/seedAdmin";

async function main() {
  // create file upload directory
  const uploadDirPath = path.resolve(process.cwd(), env.UPLOAD_DIR);
  fs.mkdirSync(uploadDirPath, { recursive: true });

  await connectDb();
  await ensureDbIndexes();
  await seedFirstAdmin();

  app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
