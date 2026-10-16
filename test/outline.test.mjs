import { test } from "node:test";
import assert from "node:assert/strict";
import esbuild from "esbuild";

const { outputFiles } = await esbuild.build({
	stdin: { contents: 'export * from "./src/outline"; export * from "./src/structures";', resolveDir: ".", loader: "ts" },
	bundle: true,
	format: "esm",
	write: false,
});
const { buildOutline, getStructure } = await import("data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64"));

const t = { chapterShort: "Cap.", chaptersCount: "capítulos", words: "palabras" };
const ch = (stage, title = "", summary = "", note = "") => ({ id: stage + title, title, summary, stage, note });
const opts = (structure, words = {}) => ({
	title: "Mi novela",
	structure: getStructure(structure),
	lang: "es",
	t,
	link: (p) => (p in words ? `[[${p.replace(/\.md$/, "")}]]` : null),
	words: (p) => words[p],
});

test("outline groups by act and stage in board order", () => {
	const board = {
		structure: "heros-journey",
		chapters: [
			ch("ordinary-world", "Café", "Ana abre la cafetería.\n\nLlueve.", "N/01.md"),
			ch("ordinary-world", "", ""),
			ch("call", "La carta", "", "N/missing.md"),
			ch("ordeal", "El sótano", "Todo arde."),
		],
	};
	assert.equal(
		buildOutline(board, opts("heros-journey", { "N/01.md": 1200 })),
		`# Mi novela

El viaje del héroe · 4 capítulos · 1200 palabras

## Acto I · Partida

### El mundo ordinario

- **Cap. 1 · Café** — [[N/01]] (1200 palabras)

  Ana abre la cafetería.

  Llueve.

- **Cap. 2**

### La llamada a la aventura

- **Cap. 3 · La carta**

## Acto II · Iniciación

### La odisea

- **Cap. 4 · El sótano**

  Todo arde.
`,
	);
});

test("structures without acts use stage headings only; repeated stages get new headings when order jumps", () => {
	const board = { structure: "kishotenketsu", chapters: [ch("ki", "A"), ch("ten", "B"), ch("ki", "C")] };
	const out = buildOutline(board, opts("kishotenketsu"));
	assert.equal(out.split("\n")[2], "Kishōtenketsu · 3 capítulos");
	assert.deepEqual(out.split("\n").filter((l) => l.startsWith("#")), [
		"# Mi novela",
		"## Ki · Introducción",
		"## Ten · Giro",
		"## Ki · Introducción",
	]);
});

test("a note linked from two chapters counts once in the total", () => {
	const board = { structure: "freytag", chapters: [ch("climax", "A", "", "x.md"), ch("climax", "B", "", "x.md")] };
	assert.match(buildOutline(board, opts("freytag", { "x.md": 10 })), /· 10 palabras/);
});
