import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadContractMeta() {
  if (process.env.CONTRACT_ABI_JSON) {
    const parsed = JSON.parse(process.env.CONTRACT_ABI_JSON);
    return {
      abi: parsed.abi ? parsed.abi : parsed,
      address: parsed.address,
    };
  }
  const abiPath = process.env.CONTRACT_ABI_PATH;
  if (!abiPath) {
    return null;
  }
  const resolved = path.isAbsolute(abiPath) ? abiPath : path.resolve(__dirname, "..", "..", abiPath);
  if (!fs.existsSync(resolved)) {
    return null;
  }
  const parsed = JSON.parse(fs.readFileSync(resolved, "utf-8"));
  return {
    abi: parsed.abi ? parsed.abi : parsed,
    address: parsed.address,
  };
}
