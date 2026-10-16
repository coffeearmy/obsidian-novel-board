import { Lang, Structure, structure } from "./structures";

export interface CustomStage {
	id: string;
	name: string;
	desc: string;
}

export interface CustomAct {
	/** Empty name = stages shown without an act heading. */
	name: string;
	hue: number;
	stages: CustomStage[];
}

export interface CustomStructure {
	id: string;
	name: string;
	acts: CustomAct[];
}

/** Post-it colors offered for acts. */
export const PALETTE: { hue: number; en: string; es: string }[] = [
	{ hue: 48, en: "Yellow", es: "Amarillo" },
	{ hue: 28, en: "Orange", es: "Naranja" },
	{ hue: 0, en: "Red", es: "Rojo" },
	{ hue: 335, en: "Pink", es: "Rosa" },
	{ hue: 285, en: "Purple", es: "Morado" },
	{ hue: 235, en: "Indigo", es: "Añil" },
	{ hue: 205, en: "Blue", es: "Azul" },
	{ hue: 175, en: "Teal", es: "Turquesa" },
	{ hue: 140, en: "Green", es: "Verde" },
	{ hue: 90, en: "Lime", es: "Lima" },
];

function shortId(): string {
	return Math.random().toString(36).slice(2, 10);
}

export function newCustomId(): string {
	return "custom-" + shortId();
}

export function newStage(name = ""): CustomStage {
	return { id: "s-" + shortId(), name, desc: "" };
}

/** Next palette color not yet used by an act (cycles when all are used). */
export function nextHue(acts: CustomAct[]): number {
	const used = new Set(acts.map((a) => a.hue));
	return (PALETTE.find((p) => !used.has(p.hue)) ?? PALETTE[acts.length % PALETTE.length]).hue;
}

export function blankCustom(name: string): CustomStructure {
	return { id: newCustomId(), name, acts: [{ name: "", hue: PALETTE[0].hue, stages: [newStage()] }] };
}

/** Copies a structure in one language. Stage ids are kept, so a board switched to the copy keeps its chapters' stages. */
export function copyStructure(src: Structure, lang: Lang, name: string): CustomStructure {
	return {
		id: newCustomId(),
		name,
		acts: src.groups.map((g) => ({
			name: g.name?.[lang] ?? "",
			hue: g.hue,
			stages: g.stages.map((st) => ({ id: st.id, name: st.name[lang], desc: st.desc[lang] })),
		})),
	};
}

export function toStructure(c: CustomStructure): Structure {
	const l = (text: string) => ({ en: text, es: text });
	let n = 0;
	return structure(
		c.id,
		l(c.name),
		c.acts
			.filter((a) => a.stages.length > 0)
			.map((a) => ({
				name: a.name.trim() ? l(a.name.trim()) : undefined,
				hue: a.hue,
				stages: a.stages.map((st) => {
					n++;
					return { id: st.id, name: l(st.name.trim() || `#${n}`), desc: l(st.desc.trim()) };
				}),
			})),
	);
}

/**
 * Moves a stage one step up or down. At the edge of an act it crosses into the neighbouring act,
 * so stages can be regrouped without retyping them.
 */
export function moveStage(acts: CustomAct[], act: number, index: number, dir: -1 | 1): void {
	const stages = acts[act]?.stages;
	if (!stages || index < 0 || index >= stages.length) return;
	const target = index + dir;
	if (target >= 0 && target < stages.length) {
		[stages[index], stages[target]] = [stages[target], stages[index]];
		return;
	}
	const neighbour = acts[act + dir];
	if (!neighbour) return;
	const [stage] = stages.splice(index, 1);
	if (dir < 0) neighbour.stages.push(stage);
	else neighbour.stages.unshift(stage);
}

export function moveAct(acts: CustomAct[], act: number, dir: -1 | 1): void {
	const target = act + dir;
	if (act < 0 || act >= acts.length || target < 0 || target >= acts.length) return;
	[acts[act], acts[target]] = [acts[target], acts[act]];
}

/** Drops acts without stages and names an untitled structure. Returns null if no stage is left. */
export function cleanCustom(c: CustomStructure, fallbackName: string): CustomStructure | null {
	const acts = c.acts.filter((a) => a.stages.length > 0);
	if (!acts.length) return null;
	return { ...c, name: c.name.trim() || fallbackName, acts };
}

export function parseCustomList(raw: unknown): CustomStructure[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.filter((c): c is CustomStructure => !!c && typeof c === "object" && typeof c.id === "string" && Array.isArray(c.acts))
		.map((c) => ({
			id: c.id,
			name: typeof c.name === "string" ? c.name : "",
			acts: c.acts
				.filter((a) => a && Array.isArray(a.stages))
				.map((a) => ({
					name: typeof a.name === "string" ? a.name : "",
					hue: typeof a.hue === "number" ? a.hue : PALETTE[0].hue,
					stages: a.stages
						.filter((st) => st && typeof st.id === "string")
						.map((st) => ({
							id: st.id,
							name: typeof st.name === "string" ? st.name : "",
							desc: typeof st.desc === "string" ? st.desc : "",
						})),
				})),
		}));
}
