import * as path from "node:path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "../.env.test") });

console.log(`dirname: ${process.cwd()}`);
