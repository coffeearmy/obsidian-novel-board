// Renders one README scene, picked by the page's #hash, using the real plugin view code.
import { TFile } from "obsidian";
import { CustomStructure } from "../../src/custom";
import { StructureEditorModal } from "../../src/editor";
import { STRINGS } from "../../src/i18n";
import { Lang } from "../../src/structures";
import { BoardView } from "../../src/view";

type Ch = [stage: string, title: string, summary: string, words?: number];

function mount(lang: Lang, boardName: string, structure: string, chapters: Ch[]) {
	const files = new Map<string, number>();
	const board = {
		structure,
		chapters: chapters.map(([stage, title, summary, words], i) => {
			const note = words ? `${boardName}/${String(i + 1).padStart(2, "0")} - ${title}.md` : "";
			if (words) files.set(note, words);
			return { id: String(i), title, summary, stage, note };
		}),
	};
	const app = {
		vault: {
			getAbstractFileByPath: (p: string) => (files.has(p) ? new TFile(p) : null),
			cachedRead: async (f: TFile) => "word ".repeat(files.get(f.path) ?? 0),
		},
		workspace: {},
		fileManager: {},
	};
	const plugin = { settings: { language: lang, defaultStructure: structure }, t: STRINGS[lang] };
	const host = document.querySelector<HTMLElement>(".view-content")!;
	const view = new BoardView({ app, contentEl: host }, plugin as any);
	view.file = new TFile(`${boardName}.storyboard`);
	view.setViewData(JSON.stringify(board), true);
	return { app, plugin };
}

const heroChapters: Ch[] = [
	["ordinary-world", "Salt and Silence", "Mara keeps the lamp on Gull Rock the way her father did: alone, on schedule, and without asking why the ships stopped coming.", 2480],
	["ordinary-world", "The Logbook", "Cleaning his desk, she finds entries in her father's handwriting dated after his funeral.", 1915],
	["call", "A Light at Sea", "A second beam answers hers from open water, where no lighthouse has ever stood.", 2210],
	["refusal", "Storm Shutters", "Mara bolts the door and tells herself it is only a reflection.", 1040],
	["mentor", "Old Tomás", "The ferryman who knew her father admits the logbook was his idea.", 860],
	["threshold", "The Rowboat", "Midnight. She rows toward the light with the lamp's spare lens wrapped in her coat."],
	["tests", "", ""],
	["ordeal", "The Drowned Tower", "Inside the impossible lighthouse, her father's voice is reading the logbook aloud."],
	["elixir", "Morning Ferry", "Ships return to Gull Rock. Mara teaches someone else the schedule."],
];

const catChapters: Ch[] = [
	["opening-image", "Telón de polvo", "El Teatro Imperial, vacío. Lucía barre el escenario donde actuó su madre.", 1830],
	["catalyst", "La carta del banco", "Treinta días para pagar la deuda o el teatro será un aparcamiento.", 2105],
	["debate", "¿Y si lo vendemos?", "Su hermano quiere aceptar la oferta. Lucía no duerme.", 1560],
	["break-into-two", "Audiciones", "Cuelga un cartel en la puerta: «Se busca compañía. Sin sueldo».", 980],
	["b-story", "Julián", "El técnico de luces que nunca habla y lo sabe todo del edificio."],
	["fun-and-games", "Ensayos imposibles", "Unos jubilados, un mago y una adolescente furiosa preparan «Fuenteovejuna»."],
	["midpoint", "Lleno total", "El estreno agota las entradas. Pero el banco adelanta el plazo."],
	["all-is-lost", "Incendio", ""],
];

const mystery: CustomStructure = {
	id: "custom-mystery",
	name: "Fair-Play Mystery",
	acts: [
		{
			name: "The Crime",
			hue: 48,
			stages: [
				{ id: "a", name: "The Body", desc: "Open on the crime, or on the moment just before it." },
				{ id: "b", name: "The Detective Arrives", desc: "Why this person, why now?" },
				{ id: "c", name: "First Suspects", desc: "" },
			],
		},
		{
			name: "The Investigation",
			hue: 205,
			stages: [
				{ id: "d", name: "False Lead", desc: "A convincing theory that will collapse." },
				{ id: "e", name: "Second Murder", desc: "" },
				{ id: "f", name: "The Clue Everyone Missed", desc: "Show it fairly; hide it in plain sight." },
			],
		},
		{
			name: "The Reveal",
			hue: 140,
			stages: [
				{ id: "g", name: "Gathering the Suspects", desc: "" },
				{ id: "h", name: "Solution", desc: "Every step must use clues the reader saw." },
			],
		},
	],
};

const scene = location.hash.slice(1);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
	if (scene === "board") {
		mount("en", "The Lighthouse Keeper", "heros-journey", heroChapters);
	} else if (scene === "board-es") {
		mount("es", "La última función", "save-the-cat", catChapters);
	} else if (scene === "editor") {
		const { app, plugin } = mount("en", "The Lighthouse Keeper", "heros-journey", heroChapters);
		new StructureEditorModal(app, plugin as any, mystery, () => {}).open();
	} else if (scene === "export") {
		mount("en", "The Lighthouse Keeper", "heros-journey", heroChapters);
		await wait(50);
		const btn = document.querySelector<HTMLElement>('[aria-label="Export outline"]')!;
		const r = btn.getBoundingClientRect();
		btn.dispatchEvent(new MouseEvent("click", { clientX: r.left - 150, clientY: r.bottom + 4 }));
	}
	await wait(100);
	document.body.dataset.ready = "1";
})();
