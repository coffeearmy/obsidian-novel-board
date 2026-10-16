import { Structure, getStructure } from "./structures";

export interface Chapter {
	id: string;
	title: string;
	summary: string;
	stage: string;
	/** Vault path of the linked chapter note, or "" if none yet. */
	note: string;
}

export interface Board {
	structure: string;
	chapters: Chapter[];
}

export function uid(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function emptyBoard(structure: string): Board {
	return { structure: getStructure(structure).id, chapters: [] };
}

/** Parses a board file. Empty or broken files become an empty board; unknown stages fall back to the first one. */
export function parseBoard(text: string, defaultStructure: string): Board {
	let raw: unknown;
	try {
		raw = text.trim() ? JSON.parse(text) : null;
	} catch {
		raw = null;
	}
	if (!raw || typeof raw !== "object") return emptyBoard(defaultStructure);
	const obj = raw as Partial<Board>;
	const structure = getStructure(typeof obj.structure === "string" ? obj.structure : defaultStructure);
	const stageIds = new Set(structure.stages.map((st) => st.id));
	const chapters = (Array.isArray(obj.chapters) ? obj.chapters : [])
		.filter((c): c is Chapter => !!c && typeof c === "object")
		.map((c) => ({
			id: typeof c.id === "string" && c.id ? c.id : uid(),
			title: typeof c.title === "string" ? c.title : "",
			summary: typeof c.summary === "string" ? c.summary : "",
			stage: stageIds.has(c.stage) ? c.stage : structure.stages[0].id,
			note: typeof c.note === "string" ? c.note : "",
		}));
	return { structure: structure.id, chapters };
}

export function serializeBoard(board: Board): string {
	return JSON.stringify(board, null, "\t");
}

export function stageIndex(structure: Structure, stageId: string): number {
	return Math.max(0, structure.stages.findIndex((st) => st.id === stageId));
}

/** Maps a stage to the stage at the same relative position in another structure. */
export function remapStage(from: Structure, to: Structure, stageId: string): string {
	const n = from.stages.length;
	const m = to.stages.length;
	const ratio = n > 1 ? stageIndex(from, stageId) / (n - 1) : 0;
	return to.stages[Math.round(ratio * (m - 1))].id;
}

export function changeStructure(board: Board, toId: string): Board {
	const from = getStructure(board.structure);
	const to = getStructure(toId);
	return {
		structure: to.id,
		chapters: board.chapters.map((c) => ({ ...c, stage: remapStage(from, to, c.stage) })),
	};
}

/** Where a new chapter of this stage goes: after the last chapter whose stage is not later in the structure. */
export function insertIndex(board: Board, stageId: string): number {
	const structure = getStructure(board.structure);
	const target = stageIndex(structure, stageId);
	for (let i = board.chapters.length - 1; i >= 0; i--) {
		if (stageIndex(structure, board.chapters[i].stage) <= target) return i + 1;
	}
	return 0;
}

export function addChapter(board: Board, stageId: string): Chapter {
	const chapter: Chapter = { id: uid(), title: "", summary: "", stage: stageId, note: "" };
	board.chapters.splice(insertIndex(board, stageId), 0, chapter);
	return chapter;
}

/** Moves the item at `from` so it ends up at index `to` of the resulting array. */
export function moveItem<T>(items: T[], from: number, to: number): void {
	if (from < 0 || from >= items.length) return;
	const clamped = Math.max(0, Math.min(items.length - 1, to));
	const [item] = items.splice(from, 1);
	items.splice(clamped, 0, item);
}

export function noteFileName(number: number, title: string, fallback: string): string {
	const clean = (title || fallback)
		.replace(/[\\/:*?"<>|#^[\]]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 80)
		.trim();
	return `${String(number).padStart(2, "0")} - ${clean || fallback}`;
}

/** Rewrites note paths after a file or folder rename. Returns true if anything changed. */
export function renameNotePaths(board: Board, oldPath: string, newPath: string): boolean {
	let changed = false;
	for (const c of board.chapters) {
		if (c.note === oldPath) {
			c.note = newPath;
			changed = true;
		} else if (c.note.startsWith(oldPath + "/")) {
			c.note = newPath + c.note.slice(oldPath.length);
			changed = true;
		}
	}
	return changed;
}

/** Counts prose words in a note, ignoring frontmatter, comments, embeds and link targets. */
export function countWords(markdown: string): number {
	const body = markdown
		.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "")
		.replace(/%%[\s\S]*?%%/g, "")
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(/!\[\[[^\]]*\]\]/g, "")
		.replace(/!\[[^\]]*\]\([^)]*\)/g, "")
		.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/https?:\/\/\S+/g, "");
	return body.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+|[.,]\p{N}+)*/gu)?.length ?? 0;
}
