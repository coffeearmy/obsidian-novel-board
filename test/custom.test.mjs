import { test } from "node:test";
import assert from "node:assert/strict";
import esbuild from "esbuild";

// One bundle so custom.ts and structures.ts share the registry.
const { outputFiles } = await esbuild.build({
	stdin: {
		contents: 'export * from "./src/custom"; export * from "./src/structures"; export * from "./src/board";',
		resolveDir: ".",
		loader: "ts",
	},
	bundle: true,
	format: "esm",
	write: false,
});
const m = await import("data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64"));

const stage = (id, name = id) => ({ id, name, desc: "" });

test("copyStructure keeps stage ids, acts and colors in one language", () => {
	const c = m.copyStructure(m.getStructure("heros-journey"), "es", "Mío");
	assert.equal(c.name, "Mío");
	assert.match(c.id, /^custom-/);
	assert.deepEqual(c.acts.map((a) => [a.name, a.hue, a.stages.length]), [
		["Acto I · Partida", 45, 5],
		["Acto II · Iniciación", 340, 4],
		["Acto III · Regreso", 150, 3],
	]);
	assert.equal(c.acts[0].stages[0].id, "ordinary-world");
	assert.equal(c.acts[0].stages[0].name, "El mundo ordinario");
	// Ungrouped built-ins become unnamed acts, one per stage.
	const k = m.copyStructure(m.getStructure("kishotenketsu"), "en", "K");
	assert.deepEqual(k.acts.map((a) => a.name), ["", "", "", ""]);
});

test("toStructure builds hues, names and placeholders", () => {
	const s = m.toStructure({
		id: "custom-x",
		name: "Thriller",
		acts: [
			{ name: " Setup ", hue: 48, stages: [stage("a", "Hook"), stage("b", "  ")] },
			{ name: "", hue: 205, stages: [] },
			{ name: "", hue: 140, stages: [stage("c", "End")] },
		],
	});
	assert.equal(s.name.es, "Thriller");
	assert.equal(s.groups.length, 2);
	assert.equal(s.groups[0].name.en, "Setup");
	assert.equal(s.groups[1].name, undefined);
	assert.deepEqual(s.stages.map((st) => [st.id, st.name.en, st.group]), [["a", "Hook", 0], ["b", "#2", 0], ["c", "End", 1]]);
});

test("big acts stay within ±18° of their hue", () => {
	const many = Array.from({ length: 12 }, (_, i) => stage("s" + i));
	const s = m.toStructure({ id: "custom-big", name: "Big", acts: [{ name: "", hue: 200, stages: many }] });
	for (const st of s.stages) assert.ok(st.hue >= 182 && st.hue <= 218, String(st.hue));
});

test("registry exposes custom structures to boards", () => {
	const custom = m.toStructure({ id: "custom-r", name: "R", acts: [{ name: "", hue: 0, stages: [stage("x"), stage("y")] }] });
	m.setCustomStructures([custom, m.toStructure({ id: "custom-empty", name: "E", acts: [] })]);
	assert.equal(m.isCustom("custom-r"), true);
	assert.equal(m.isCustom("custom-empty"), false);
	assert.equal(m.getStructure("custom-r").stages.length, 2);
	const b = m.parseBoard(JSON.stringify({ structure: "custom-r", chapters: [{ id: "1", stage: "y" }, { id: "2", stage: "gone" }] }), "freytag");
	assert.equal(b.structure, "custom-r");
	assert.deepEqual(b.chapters.map((c) => c.stage), ["y", "x"]);
	m.setCustomStructures([]);
	assert.equal(m.parseBoard(JSON.stringify({ structure: "custom-r", chapters: [] }), "freytag").structure, "heros-journey");
});

test("moveStage crosses act boundaries", () => {
	const acts = [
		{ name: "1", hue: 0, stages: [stage("a"), stage("b")] },
		{ name: "2", hue: 0, stages: [stage("c")] },
	];
	m.moveStage(acts, 0, 0, 1);
	assert.deepEqual(acts.map((a) => a.stages.map((s) => s.id)), [["b", "a"], ["c"]]);
	m.moveStage(acts, 0, 1, 1);
	assert.deepEqual(acts.map((a) => a.stages.map((s) => s.id)), [["b"], ["a", "c"]]);
	m.moveStage(acts, 1, 0, -1);
	assert.deepEqual(acts.map((a) => a.stages.map((s) => s.id)), [["b", "a"], ["c"]]);
	m.moveStage(acts, 0, 0, -1); // first stage of first act: no-op
	assert.deepEqual(acts.map((a) => a.stages.map((s) => s.id)), [["b", "a"], ["c"]]);
	m.moveAct(acts, 1, -1);
	assert.deepEqual(acts.map((a) => a.name), ["2", "1"]);
});

test("cleanCustom, nextHue, parseCustomList", () => {
	assert.equal(m.cleanCustom({ id: "c", name: "x", acts: [{ name: "", hue: 0, stages: [] }] }, "U"), null);
	const ok = m.cleanCustom({ id: "c", name: "  ", acts: [{ name: "", hue: 0, stages: [] }, { name: "", hue: 1, stages: [stage("a")] }] }, "U");
	assert.equal(ok.name, "U");
	assert.equal(ok.acts.length, 1);
	assert.equal(m.nextHue([{ hue: 48 }, { hue: 28 }]), 0);
	assert.deepEqual(m.parseCustomList("nope"), []);
	assert.deepEqual(m.parseCustomList([{ id: "c", name: 5, acts: [{ stages: [{ id: "s", name: "N" }, { name: "no id" }] }] }, null]), [
		{ id: "c", name: "", acts: [{ name: "", hue: 48, stages: [{ id: "s", name: "N", desc: "" }] }] },
	]);
});
