import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const sourceFile = join(currentDir, "ses-s3-to-rentapp-lambda.mjs");
const distDir = join(currentDir, "dist");
const buildDir = join(distDir, "rentapp-ses-inbound");
const zipPath = join(distDir, "rentapp-ses-inbound.zip");

rmSync(buildDir, { recursive: true, force: true });
mkdirSync(buildDir, { recursive: true });
mkdirSync(distDir, { recursive: true });

cpSync(sourceFile, join(buildDir, "index.mjs"));

writeFileSync(
    join(buildDir, "package.json"),
    JSON.stringify({
        name: "rentapp-ses-inbound",
        private: true,
        type: "module",
        dependencies: {
            "@aws-sdk/client-s3": "^3.1049.0",
            "postal-mime": "^2.4.4",
        },
    }, null, 2),
);

execFileSync("npm", ["install", "--omit=dev"], {
    cwd: buildDir,
    stdio: "inherit",
});

if (existsSync(zipPath)) {
    rmSync(zipPath, { force: true });
}

execFileSync("zip", ["-qr", zipPath, "."], {
    cwd: buildDir,
    stdio: "inherit",
});

console.log(`Lambda zip elkészült: ${resolve(zipPath)}`);
