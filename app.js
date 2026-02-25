import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

process.env.NODE_ENV = "production";
process.env.PORT = process.env.PORT || "3000";

await import(join(__dirname, "dist", "index.mjs"));
