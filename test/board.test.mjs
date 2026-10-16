import { test } from "node:test";
import assert from "node:assert/strict";
import esbuild from "esbuild";

const { outputFiles } = await esbuild.build({ entryPoints: ["src/board.ts"], bundle: true, format: "esm", write: false });
const {
	parseBoard,
	serializeBoard,
	remapStage,
	changeStructure,
	insertIndex,
	addChapter,
	moveItem,
	noteFileName,
	renameNotePaths,
	countWords,
} = await import("data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64"));

const { outputFiles: sOut } = await esbuild.build({ entryPoints: ["src/structures.ts"], bundle: true, format: "esm", write: false });
const { STRUCTURES, getStructure } = await import("data:text/javascript;base64," + Buffer.from(sOut[0].text).toString("base64"));

const ch = (stage, title = "") => ({ id: title || stage, title, summary: "", stage, note: "" });

test("structures have expected stage counts and unique ids", () => {
	const counts = Object.fromEntries(STRUCTURES.map((s) => [s.id, s.stages.length]));
	assert.deepEqual(counts, {
		"heros-journey": 12,
		"save-the-cat": 15,
		"three-act": 8,
		"seven-point": 7,
		freytag: 5,
		kishotenketsu: 4,
	});
	for (const s of STRUCTURES) {
		assert.equal(new Set(s.stages.map((st) => st.id)).size, s.stages.length, s.id);
		for (const st of s.stages) {
			assert.ok(st.name.en && st.name.es && st.desc.en && st.desc.es, `${s.id}/${st.id}`);
			assert.ok(st.hue >= 0 && st.hue < 360);
		}
	}
});

test("parseBoard handles empty, broken and partial input", () => {
	assert.deepEqual(parseBoard("", "save-the-cat"), { structure: "save-the-cat", chapters: [] });
	assert.deepEqual(parseBoard("{nope", "freytag"), { structure: "freytag", chapters: [] });
	const b = parseBoard(JSON.stringify({ structure: "freytag", chapters: [{ id: "a", stage: "bogus", title: 3 }, null] }), "x");
	assert.deepEqual(b.chapters, [{ id: "a", title: "", summary: "", stage: "exposition", note: "" }]);
});

test("serialize round-trips", () => {
	const b = { structure: "three-act", chapters: [{ id: "1", title: "Uno", summary: "s", stage: "climax", note: "N/01.md" }] };
	assert.deepEqual(parseBoard(serializeBoard(b), "heros-journey"), b);
});

test("remapStage keeps relative position", () => {
	const hj = getStructure("heros-journey");
	const k = getStructure("kishotenketsu");
	assert.equal(remapStage(hj, k, "ordinary-world"), "ki");
	assert.equal(remapStage(hj, k, "elixir"), "ketsu");
	assert.equal(remapStage(k, hj, "ten"), "ordeal");
});

test("changeStructure remaps every chapter", () => {
	const b = changeStructure({ structure: "freytag", chapters: [ch("exposition"), ch("denouement")] }, "save-the-cat");
	assert.equal(b.structure, "save-the-cat");
	assert.deepEqual(b.chapters.map((c) => c.stage), ["opening-image", "final-image"]);
});

test("insertIndex places new chapter after its stage", () => {
	const b = { structure: "freytag", chapters: [ch("exposition", "a"), ch("climax", "b"), ch("denouement", "c")] };
	assert.equal(insertIndex(b, "exposition"), 1);
	assert.equal(insertIndex(b, "rising-action"), 1);
	assert.equal(insertIndex(b, "climax"), 2);
	assert.equal(insertIndex(b, "denouement"), 3);
	assert.equal(insertIndex({ structure: "freytag", chapters: [ch("climax")] }, "exposition"), 0);
	const added = addChapter(b, "rising-action");
	assert.equal(b.chapters[1], added);
});

test("moveItem", () => {
	const a = [1, 2, 3, 4];
	moveItem(a, 0, 2);
	assert.deepEqual(a, [2, 3, 1, 4]);
	moveItem(a, 3, 0);
	assert.deepEqual(a, [4, 2, 3, 1]);
	moveItem(a, 1, 99);
	assert.deepEqual(a, [4, 3, 1, 2]);
});

test("noteFileName sanitizes and pads", () => {
	assert.equal(noteFileName(3, "  El  mundo: ordinario?  ", "Capítulo 3"), "03 - El mundo ordinario");
	assert.equal(noteFileName(12, "", "Capítulo 12"), "12 - Capítulo 12");
	assert.equal(noteFileName(1, "###", "Chapter 1"), "01 - Chapter 1");
});

test("renameNotePaths follows file and folder renames", () => {
	const b = { structure: "freytag", chapters: [{ ...ch("climax"), note: "Novel/01 - A.md" }, { ...ch("climax", "x"), note: "Other.md" }] };
	assert.equal(renameNotePaths(b, "Novel/01 - A.md", "Novel/01 - B.md"), true);
	assert.equal(b.chapters[0].note, "Novel/01 - B.md");
	assert.equal(renameNotePaths(b, "Novel", "Book"), true);
	assert.equal(b.chapters[0].note, "Book/01 - B.md");
	assert.equal(renameNotePaths(b, "Nov", "X"), false);
});

test("countWords counts prose only", () => {
	assert.equal(countWords(""), 0);
	assert.equal(countWords("---\nboard: \"[[Novela.storyboard]]\"\nstage: \"La odisea\"\n---\n\n# El cruce\n\n"), 2);
	assert.equal(countWords("—Me parece que me estás engañando —susurró Víctor—, pero no importa."), 11);
	assert.equal(countWords("Su ex-novio llegó a las 3.30, ¿o no?"), 8);
	assert.equal(countWords("Fue a [[Lugares/Madrid|la capital]] y vio [esto](https://x.com/a)."), 7);
	assert.equal(countWords("Texto %%nota privada%% visible <!-- oculto --> ![[foto.png]] fin"), 3);
});
