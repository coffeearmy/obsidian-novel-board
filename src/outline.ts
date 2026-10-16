import { Board } from "./board";
import { Lang, Structure } from "./structures";

export interface OutlineOptions {
	title: string;
	structure: Structure;
	lang: Lang;
	t: { chapterShort: string; chaptersCount: string; words: string };
	/** Markdown link to a chapter note, or null if the note doesn't exist. */
	link: (path: string) => string | null;
	/** Word count of a chapter note, if known. */
	words: (path: string) => number | undefined;
}

/**
 * Markdown outline in board order. Act and stage headings are emitted whenever they change,
 * so reordered chapters keep their position and still show where they sit in the structure.
 */
export function buildOutline(board: Board, o: OutlineOptions): string {
	const { structure, lang, t } = o;
	const fmt = (n: number) => n.toLocaleString(lang);
	const hasActs = structure.groups.some((g) => g.name);
	const stageLevel = hasActs ? "###" : "##";

	const counted = new Set<string>();
	let total = 0;
	for (const c of board.chapters) {
		const n = c.note ? o.words(c.note) : undefined;
		if (n !== undefined && !counted.has(c.note)) {
			counted.add(c.note);
			total += n;
		}
	}

	const out: string[] = [`# ${o.title}`, ""];
	const meta = [structure.name[lang], `${fmt(board.chapters.length)} ${t.chaptersCount}`];
	if (counted.size) meta.push(`${fmt(total)} ${t.words}`);
	out.push(meta.join(" · "), "");

	let lastGroup = -1;
	let lastStage = "";
	board.chapters.forEach((c, i) => {
		const stage = structure.stages.find((st) => st.id === c.stage) ?? structure.stages[0];
		const group = structure.groups[stage.group];
		if (hasActs && stage.group !== lastGroup) {
			if (group.name) out.push(`## ${group.name[lang]}`, "");
			lastGroup = stage.group;
			lastStage = "";
		}
		if (stage.id !== lastStage) {
			out.push(`${stageLevel} ${stage.name[lang]}`, "");
			lastStage = stage.id;
		}

		const title = c.title.trim();
		let line = `- **${t.chapterShort} ${i + 1}${title ? ` · ${title}` : ""}**`;
		const link = c.note ? o.link(c.note) : null;
		if (link) {
			line += ` — ${link}`;
			const n = o.words(c.note);
			if (n !== undefined) line += ` (${fmt(n)} ${t.words})`;
		}
		out.push(line, "");
		for (const para of c.summary.split(/\n+/)) {
			if (para.trim()) out.push(`  ${para.trim()}`, "");
		}
	});

	return out.join("\n").replace(/\n+$/, "\n");
}
