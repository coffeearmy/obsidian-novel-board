// Regenerates the README screenshots: renders the real board/editor code against a mock Obsidian API,
// styled with Obsidian's own app.css (read from the local Obsidian.app, never committed), via headless Chrome.
// Usage: npm run screenshots   (macOS, needs Obsidian and Google Chrome installed)
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, openSync, readSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import esbuild from "esbuild";

const ASAR = "/Applications/Obsidian.app/Contents/Resources/obsidian.asar";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = resolve(import.meta.dirname, "../..");
const outDir = join(root, "docs/images");
const work = mkdtempSync(join(tmpdir(), "nsb-shots-"));
mkdirSync(outDir, { recursive: true });

function extractFromAsar(name) {
	const fd = openSync(ASAR, "r");
	const head = Buffer.alloc(16);
	readSync(fd, head, 0, 16, 0);
	const headerSize = head.readUInt32LE(4);
	const jsonLen = head.readUInt32LE(12);
	const json = Buffer.alloc(jsonLen);
	readSync(fd, json, 0, jsonLen, 16);
	const entry = JSON.parse(json.toString()).files[name];
	const data = Buffer.alloc(entry.size);
	readSync(fd, data, 0, entry.size, 8 + headerSize + Number(entry.offset));
	return data;
}

writeFileSync(join(work, "app.css"), extractFromAsar("app.css"));
copyFileSync(join(root, "styles.css"), join(work, "styles.css"));
await esbuild.build({
	entryPoints: [join(root, "docs/harness/scenes.ts")],
	bundle: true,
	format: "iife",
	outfile: join(work, "scenes.js"),
	alias: { obsidian: join(root, "docs/harness/obsidian-mock.ts") },
	logLevel: "warning",
});

const scenes = [
	{ name: "board", theme: "light", size: [1440, 715] },
	{ name: "board-es", theme: "dark", size: [1440, 715] },
	{ name: "editor", theme: "light", size: [1440, 940] },
	{ name: "export", theme: "light", size: [1440, 330] },
];

for (const s of scenes) {
	const html = join(work, `${s.name}.html`);
	writeFileSync(
		html,
		`<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="app.css"><link rel="stylesheet" href="styles.css">
<style>
	body { overflow: hidden; }
	.workspace-leaf { position: fixed; inset: 0; }
	.workspace-leaf-content { position: absolute; inset: 0; background: var(--background-primary); }
	.view-content { height: 100%; overflow: hidden; }
</style></head>
<body class="theme-${s.theme} mod-macos is-focused">
<div class="workspace-leaf mod-active"><div class="workspace-leaf-content"><div class="view-content"></div></div></div>
<script src="scenes.js"></script></body></html>`,
	);
	const png = join(outDir, `${s.name}.png`);
	execFileSync(CHROME, [
		"--headless=new",
		"--disable-gpu",
		"--hide-scrollbars",
		"--force-device-scale-factor=2",
		`--window-size=${s.size.join(",")}`,
		"--virtual-time-budget=3000",
		`--screenshot=${png}`,
		`file://${html}#${s.name}`,
	], { stdio: "ignore" });
	console.log("wrote", png);
}
