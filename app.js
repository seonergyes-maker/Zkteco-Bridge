const path = require("path");
process.env.NODE_ENV = "production";
process.env.PORT = process.env.PORT || "3000";
require(path.join(__dirname, "dist", "index.cjs"));
