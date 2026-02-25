import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

process.env.NODE_ENV = "production";
process.env.PORT = process.env.PORT || "3000";

const entry = join(__dirname, "dist", "index.cjs");

import(pathToFileURL(entry).href).catch((err) => {
  console.error("Error cargando dist/index.cjs:", err);
  process.exit(1);
});
