import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, SettingDefinitionItem, TFolder, moment, normalizePath } from "obsidian";
import { emptyBoard, serializeBoard } from "./board";
import { CustomStructure, blankCustom, copyStructure, parseCustomList, toStructure } from "./custom";
import { StructureEditorModal } from "./editor";
import { STRINGS, Strings } from "./i18n";
import { Lang, STRUCTURES, allStructures, getStructure, setCustomStructures } from "./structures";
import { BoardView, EXTENSION, VIEW_TYPE, confirm } from "./view";

interface NovelBoardSettings {
	language: Lang;
	defaultStructure: string;
	customStructures: CustomStructure[];
}

const DEFAULT_SETTINGS: NovelBoardSettings = {
	language: moment.locale().startsWith("es") ? "es" : "en",
	defaultStructure: STRUCTURES[0].id,
	customStructures: [],
};

export default class NovelBoardPlugin extends Plugin {
	settings: NovelBoardSettings = DEFAULT_SETTINGS;

	get t(): Strings {
		return STRINGS[this.settings.language];
	}

	async onload() {
		await this.loadSettings();
		this.registerView(VIEW_TYPE, (leaf) => new BoardView(leaf, this));
		this.registerExtensions([EXTENSION], VIEW_TYPE);

		this.addRibbonIcon("layout-grid", this.t.newBoard, () => this.promptNewBoard());
		this.addCommand({
			id: "new-board",
			name: this.t.newBoard,
			callback: () => this.promptNewBoard(),
		});
		this.addCommand({
			id: "copy-outline",
			name: this.t.copyOutline,
			checkCallback: (checking) => {
				const view = this.app.workspace.getActiveViewOfType(BoardView);
				if (view && !checking) void view.copyOutline();
				return !!view;
			},
		});
		this.addCommand({
			id: "save-outline",
			name: this.t.saveOutline,
			checkCallback: (checking) => {
				const view = this.app.workspace.getActiveViewOfType(BoardView);
				if (view && !checking) void view.saveOutline();
				return !!view;
			},
		});
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (!(file instanceof TFolder)) return;
				menu.addItem((item) =>
					item.setTitle(this.t.newBoard).setIcon("layout-grid").onClick(() => this.promptNewBoard(file)),
				);
			}),
		);
		this.addSettingTab(new NovelBoardSettingTab(this.app, this));
	}

	async loadSettings() {
		const data = (await this.loadData()) as (Partial<NovelBoardSettings> & { customStructures?: unknown }) | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data, {
			customStructures: parseCustomList(data?.customStructures),
		});
		setCustomStructures(this.settings.customStructures.map(toStructure));
	}

	async saveSettings() {
		setCustomStructures(this.settings.customStructures.map(toStructure));
		await this.saveData(this.settings);
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
			if (leaf.view instanceof BoardView) leaf.view.render();
		}
	}

	/** Opens the editor on a new structure, blank or copied from `fromId`; `onCreated` runs once it is saved. */
	newCustom(fromId: string | null, onCreated?: (id: string) => void) {
		const draft = fromId
			? copyStructure(getStructure(fromId), this.settings.language, `${getStructure(fromId).name[this.settings.language]} (${this.t.copyOf})`)
			: blankCustom(this.t.untitled);
		new StructureEditorModal(this.app, this, draft, async (saved) => {
			this.settings.customStructures.push(saved);
			await this.saveSettings();
			onCreated?.(saved.id);
		}).open();
	}

	editCustom(id: string, onSaved?: () => void) {
		const list = this.settings.customStructures;
		const current = list.find((c) => c.id === id);
		if (!current) return;
		new StructureEditorModal(this.app, this, current, async (saved) => {
			list.splice(list.indexOf(current), 1, saved);
			await this.saveSettings();
			onSaved?.();
		}).open();
	}

	manageCustom(onDone?: () => void) {
		new CustomStructuresModal(this.app, this, onDone).open();
	}

	async deleteCustom(id: string): Promise<boolean> {
		if (!(await confirm(this.app, this.t.deleteStructureConfirm, this.t))) return false;
		this.settings.customStructures = this.settings.customStructures.filter((c) => c.id !== id);
		if (this.settings.defaultStructure === id) this.settings.defaultStructure = STRUCTURES[0].id;
		await this.saveSettings();
		return true;
	}

	promptNewBoard(folder?: TFolder) {
		const parent = folder ?? this.app.fileManager.getNewFileParent(this.app.workspace.getActiveFile()?.path ?? "");
		new NewBoardModal(this.app, this, async (name, structure) => {
			const path = normalizePath(`${parent.path === "/" ? "" : parent.path + "/"}${name}.${EXTENSION}`);
			if (this.app.vault.getAbstractFileByPath(path)) {
				new Notice(this.t.exists);
				return false;
			}
			const file = await this.app.vault.create(path, serializeBoard(emptyBoard(structure)));
			await this.app.workspace.getLeaf("tab").openFile(file);
			return true;
		}).open();
	}
}

class NewBoardModal extends Modal {
	constructor(
		app: App,
		private plugin: NovelBoardPlugin,
		private onSubmit: (name: string, structure: string) => Promise<boolean>,
	) {
		super(app);
	}

	onOpen() {
		const t = this.plugin.t;
		const lang = this.plugin.settings.language;
		let name = "";
		let structure = this.plugin.settings.defaultStructure;
		this.titleEl.setText(t.newBoard);

		const submit = async () => {
			const clean = name.replace(/[\\/:*?"<>|#^[\]]/g, "").trim();
			if (clean && (await this.onSubmit(clean, structure))) this.close();
		};

		new Setting(this.contentEl).setName(t.name).addText((text) => {
			text.onChange((v) => (name = v));
			text.inputEl.addEventListener("keydown", (e) => {
				if (e.key === "Enter") void submit();
			});
			window.setTimeout(() => text.inputEl.focus(), 0);
		});
		new Setting(this.contentEl).setName(t.structure).addDropdown((dd) => {
			for (const st of allStructures()) dd.addOption(st.id, st.name[lang]);
			dd.setValue(structure).onChange((v) => (structure = v));
		});
		new Setting(this.contentEl).addButton((b) => b.setButtonText(t.createBoard).setCta().onClick(submit));
	}

	onClose() {
		this.contentEl.empty();
	}
}

const LANGUAGES: Record<Lang, string> = { es: "Español", en: "English" };

class NovelBoardSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: NovelBoardPlugin,
	) {
		super(app, plugin);
	}

	private structureOptions(): Record<string, string> {
		return Object.fromEntries(allStructures().map((st) => [st.id, st.name[this.plugin.settings.language]]));
	}

	private customSummary(): string {
		const n = this.plugin.settings.customStructures.length;
		return n ? `${n} · ${this.plugin.settings.customStructures.map((c) => c.name).join(", ")}` : this.plugin.t.noCustomStructures;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const t = this.plugin.t;
		return [
			{ name: t.language, desc: t.languageDesc, control: { type: "dropdown", key: "language", options: LANGUAGES } },
			{
				name: t.defaultStructure,
				desc: t.defaultStructureDesc,
				control: { type: "dropdown", key: "defaultStructure", options: this.structureOptions() },
			},
			{ name: t.customStructures, desc: this.customSummary(), action: () => this.plugin.manageCustom() },
		];
	}

	getControlValue(key: string): unknown {
		return this.plugin.settings[key as "language" | "defaultStructure"];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (typeof value !== "string") return;
		if (key === "language") this.plugin.settings.language = value as Lang;
		if (key === "defaultStructure") this.plugin.settings.defaultStructure = value;
		await this.plugin.saveSettings();
	}

	/** Fallback for Obsidian < 1.13, which never calls getSettingDefinitions(). */
	display(): void {
		this.renderFallback();
	}

	private renderFallback() {
		const { containerEl } = this;
		const t = this.plugin.t;
		containerEl.empty();
		new Setting(containerEl)
			.setName(t.language)
			.setDesc(t.languageDesc)
			.addDropdown((dd) =>
				dd
					.addOptions(LANGUAGES)
					.setValue(this.plugin.settings.language)
					.onChange(async (v) => {
						this.plugin.settings.language = v as Lang;
						await this.plugin.saveSettings();
						this.renderFallback();
					}),
			);
		new Setting(containerEl)
			.setName(t.defaultStructure)
			.setDesc(t.defaultStructureDesc)
			.addDropdown((dd) =>
				dd
					.addOptions(this.structureOptions())
					.setValue(this.plugin.settings.defaultStructure)
					.onChange(async (v) => {
						this.plugin.settings.defaultStructure = v;
						await this.plugin.saveSettings();
					}),
			);
		new Setting(containerEl)
			.setName(t.customStructures)
			.setDesc(this.customSummary())
			.addButton((b) => b.setButtonText(t.manage).onClick(() => this.plugin.manageCustom(() => this.renderFallback())));
	}
}

/** Lists the custom structures with edit and delete buttons, and creates new ones (blank or copied). */
class CustomStructuresModal extends Modal {
	constructor(
		app: App,
		private plugin: NovelBoardPlugin,
		private onDone?: () => void,
	) {
		super(app);
	}

	onOpen() {
		this.titleEl.setText(this.plugin.t.customStructures);
		this.render();
	}

	onClose() {
		this.contentEl.empty();
		this.onDone?.();
	}

	private render() {
		const t = this.plugin.t;
		const lang = this.plugin.settings.language;
		const el = this.contentEl;
		el.empty();
		const list = this.plugin.settings.customStructures;
		if (!list.length) el.createEl("p", { cls: "setting-item-description", text: t.noCustomStructures });
		for (const c of list) {
			const stages = c.acts.reduce((n, a) => n + a.stages.length, 0);
			new Setting(el)
				.setName(c.name)
				.setDesc(`${stages} ${t.stagesCount}`)
				.addExtraButton((b) =>
					b
						.setIcon("pencil")
						.setTooltip(t.editStructure)
						.onClick(() => this.plugin.editCustom(c.id, () => this.render())),
				)
				.addExtraButton((b) =>
					b
						.setIcon("trash-2")
						.setTooltip(t.deleteStructure)
						.onClick(async () => {
							if (await this.plugin.deleteCustom(c.id)) this.render();
						}),
				);
		}
		let from = "";
		new Setting(el)
			.setName(t.newStructure)
			.setDesc(t.newStructureDesc)
			.addDropdown((dd) => {
				dd.addOption("", t.startBlank);
				for (const st of allStructures()) dd.addOption(st.id, st.name[lang]);
				dd.setValue(from).onChange((v) => (from = v));
			})
			.addButton((b) =>
				b
					.setButtonText(t.create)
					.setCta()
					.onClick(() => this.plugin.newCustom(from || null, () => this.render())),
			);
	}
}
