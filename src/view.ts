import { App, Keymap, Menu, Modal, Notice, Setting, TFile, TFolder, TextFileView, WorkspaceLeaf, normalizePath, setIcon } from "obsidian";
import {
	Board,
	Chapter,
	addChapter,
	changeStructure,
	countWords,
	emptyBoard,
	moveItem,
	noteFileName,
	parseBoard,
	renameNotePaths,
	serializeBoard,
} from "./board";
import { buildOutline } from "./outline";
import { STRUCTURES, Stage, allStructures, getStructure, isCustom } from "./structures";
import type NovelBoardPlugin from "./main";

export const VIEW_TYPE = "novel-structure-board";
export const EXTENSION = "storyboard";

export class BoardView extends TextFileView {
	board: Board;
	private dragId: string | null = null;
	/** Word count per linked note path. */
	private wordCounts = new Map<string, number>();

	constructor(leaf: WorkspaceLeaf, private plugin: NovelBoardPlugin) {
		super(leaf);
		this.board = emptyBoard(plugin.settings.defaultStructure);
	}

	getViewType() {
		return VIEW_TYPE;
	}

	getIcon() {
		return "layout-grid";
	}

	getDisplayText() {
		return this.file?.basename ?? this.plugin.t.boardName;
	}

	async onOpen() {
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (renameNotePaths(this.board, oldPath, file.path)) {
					this.requestSave();
					this.render();
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				this.wordCounts.delete(file.path);
				if (this.board.chapters.some((c) => c.note === file.path)) this.render();
			}),
		);
		this.registerEvent(
			this.app.vault.on("modify", async (file) => {
				if (!(file instanceof TFile) || !this.board.chapters.some((c) => c.note === file.path)) return;
				await this.countFile(file);
				this.paintWordCounts();
			}),
		);
	}

	getViewData() {
		return serializeBoard(this.board);
	}

	setViewData(data: string, _clear: boolean) {
		this.board = parseBoard(data, this.plugin.settings.defaultStructure);
		this.render();
	}

	clear() {
		this.board = emptyBoard(this.plugin.settings.defaultStructure);
	}

	private get lang() {
		return this.plugin.settings.language;
	}

	private commit(rerender = true) {
		this.requestSave();
		if (rerender) this.render();
	}

	render() {
		const t = this.plugin.t;
		const structure = getStructure(this.board.structure);
		const el = this.contentEl;
		el.empty();
		const root = el.createDiv("nsb-board");

		const header = root.createDiv("nsb-header");
		const select = header.createEl("select", { cls: "dropdown nsb-structure", attr: { "aria-label": t.structure } });
		const customs = allStructures().filter((st) => isCustom(st.id));
		const builtInGroup = customs.length ? select.createEl("optgroup", { attr: { label: t.builtIn } }) : select;
		for (const st of STRUCTURES) builtInGroup.createEl("option", { value: st.id, text: st.name[this.lang] });
		if (customs.length) {
			const customGroup = select.createEl("optgroup", { attr: { label: t.customStructures } });
			for (const st of customs) customGroup.createEl("option", { value: st.id, text: st.name[this.lang] });
		}
		select.value = structure.id;
		select.onchange = async () => {
			const to = select.value;
			if (this.board.chapters.length && !(await confirm(this.app, t.changeConfirm, t))) {
				select.value = structure.id;
				return;
			}
			this.board = changeStructure(this.board, to);
			this.commit();
		};
		const custom = isCustom(structure.id);
		const editBtn = header.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": custom ? t.editStructure : t.customize },
		});
		setIcon(editBtn, custom ? "pencil" : "copy-plus");
		editBtn.onclick = () => {
			if (custom) {
				this.plugin.editCustom(structure.id);
				return;
			}
			// The copy keeps stage ids, so chapters stay in their stages.
			this.plugin.newCustom(structure.id, (id) => {
				this.board.structure = id;
				this.commit();
			});
		};
		header.createDiv("nsb-spacer");
		header.createSpan({ cls: "nsb-total" });
		const exportBtn = header.createEl("button", { cls: "clickable-icon", attr: { "aria-label": t.exportOutline } });
		setIcon(exportBtn, "list-tree");
		exportBtn.onclick = (e) => {
			const menu = new Menu();
			menu.addItem((item) => item.setTitle(t.copyOutline).setIcon("copy").onClick(() => this.copyOutline()));
			menu.addItem((item) => item.setTitle(t.saveOutline).setIcon("file-output").onClick(() => this.saveOutline()));
			menu.showAtMouseEvent(e);
		};
		const addBtn = header.createEl("button", { cls: "mod-cta", text: t.addChapter });
		addBtn.onclick = () => {
			const last = this.board.chapters[this.board.chapters.length - 1];
			this.addAndFocus(last?.stage ?? structure.stages[0].id);
		};

		this.renderLegend(root, structure.groups.map((g, gi) => ({
			name: g.name?.[this.lang],
			stages: structure.stages.filter((st) => st.group === gi),
		})));

		const grid = root.createDiv("nsb-grid");
		if (!this.board.chapters.length) {
			const empty = grid.createDiv("nsb-empty");
			empty.createEl("p", { text: t.emptyHint });
			const fill = empty.createEl("button", { text: t.fillStages });
			fill.onclick = () => {
				for (const st of structure.stages) addChapter(this.board, st.id);
				this.commit();
			};
			return;
		}
		this.board.chapters.forEach((ch, i) => this.renderCard(grid, ch, i, structure.stages));
		const addTile = grid.createDiv({ cls: "nsb-add-tile", attr: { "aria-label": t.addChapter } });
		setIcon(addTile, "plus");
		addTile.onclick = () => addBtn.click();
		this.paintWordCounts();
		void this.loadWordCounts();
	}

	private async outlineText(sourcePath: string): Promise<string> {
		await this.loadWordCounts();
		return buildOutline(this.board, {
			title: this.file?.basename ?? this.plugin.t.boardName,
			structure: getStructure(this.board.structure),
			lang: this.lang,
			t: this.plugin.t,
			link: (path) => {
				const f = this.app.vault.getAbstractFileByPath(path);
				return f instanceof TFile ? this.app.fileManager.generateMarkdownLink(f, sourcePath) : null;
			},
			words: (path) => this.wordCounts.get(path),
		});
	}

	async copyOutline() {
		await navigator.clipboard.writeText(await this.outlineText(this.file?.path ?? ""));
		new Notice(this.plugin.t.outlineCopied);
	}

	/** Writes the outline to "<board> - Outline.md" next to the board, asking before replacing it. */
	async saveOutline() {
		if (!this.file) return;
		const t = this.plugin.t;
		const parent = this.file.parent?.path ?? "";
		const prefix = parent && parent !== "/" ? parent + "/" : "";
		const path = normalizePath(`${prefix}${this.file.basename} - ${t.outlineSuffix}.md`);
		const text = await this.outlineText(path);
		const existing = this.app.vault.getAbstractFileByPath(path);
		let file: TFile;
		if (existing instanceof TFile) {
			if (!(await confirm(this.app, t.overwriteConfirm.replace("{name}", existing.basename), t))) return;
			await this.app.vault.modify(existing, text);
			file = existing;
		} else {
			file = await this.app.vault.create(path, text);
		}
		await this.app.workspace.getLeaf("tab").openFile(file);
	}

	private linkedNotes(): TFile[] {
		const files = new Map<string, TFile>();
		for (const c of this.board.chapters) {
			const f = c.note ? this.app.vault.getAbstractFileByPath(c.note) : null;
			if (f instanceof TFile) files.set(f.path, f);
		}
		return [...files.values()];
	}

	private async countFile(file: TFile) {
		this.wordCounts.set(file.path, countWords(await this.app.vault.cachedRead(file)));
	}

	/** Reads notes whose count isn't cached yet, then repaints. */
	private async loadWordCounts() {
		const missing = this.linkedNotes().filter((f) => !this.wordCounts.has(f.path));
		if (!missing.length) return;
		await Promise.all(missing.map((f) => this.countFile(f)));
		this.paintWordCounts();
	}

	/** Updates count labels in place, so typing on the board never loses focus. */
	private paintWordCounts() {
		const fmt = (n: number) => `${n.toLocaleString(this.lang)} ${this.plugin.t.words}`;
		this.contentEl.querySelectorAll<HTMLElement>(".nsb-words").forEach((el) => {
			const n = this.wordCounts.get(el.dataset.note ?? "");
			el.setText(n === undefined ? "…" : fmt(n));
		});
		const total = this.contentEl.querySelector<HTMLElement>(".nsb-total");
		if (!total) return;
		const notes = this.linkedNotes();
		total.toggle(notes.length > 0);
		total.setText(fmt(notes.reduce((sum, f) => sum + (this.wordCounts.get(f.path) ?? 0), 0)));
	}

	private renderLegend(root: HTMLElement, groups: { name?: string; stages: Stage[] }[]) {
		const legend = root.createDiv({ cls: "nsb-legend", attr: { title: this.plugin.t.legendHint } });
		for (const g of groups) {
			const groupEl = legend.createDiv("nsb-legend-group");
			if (g.name) groupEl.createDiv({ cls: "nsb-legend-title", text: g.name });
			const chips = groupEl.createDiv("nsb-legend-chips");
			for (const st of g.stages) {
				const count = this.board.chapters.filter((c) => c.stage === st.id).length;
				const chip = chips.createDiv({
					cls: "nsb-chip" + (count ? "" : " is-empty"),
					attr: { title: st.desc[this.lang], role: "button", tabindex: "0" },
				});
				chip.style.setProperty("--nsb-hue", String(st.hue));
				chip.createSpan({ text: st.name[this.lang] });
				chip.createSpan({ cls: "nsb-chip-count", text: String(count) });
				chip.onclick = () => this.addAndFocus(st.id);
				chip.onkeydown = (e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						this.addAndFocus(st.id);
					}
				};
			}
		}
	}

	private addAndFocus(stageId: string) {
		const ch = addChapter(this.board, stageId);
		this.commit();
		const input = this.contentEl.querySelector<HTMLElement>(`[data-id="${ch.id}"] .nsb-title`);
		input?.scrollIntoView({ block: "nearest" });
		input?.focus();
	}

	private renderCard(grid: HTMLElement, ch: Chapter, index: number, stages: Stage[]) {
		const t = this.plugin.t;
		const stage = stages.find((st) => st.id === ch.stage) ?? stages[0];
		const card = grid.createDiv({ cls: "nsb-card", attr: { "data-id": ch.id } });
		card.style.setProperty("--nsb-hue", String(stage.hue));

		const top = card.createDiv("nsb-card-top");
		const handle = top.createDiv({ cls: "nsb-handle", attr: { draggable: "true", "aria-label": t.dragHint } });
		setIcon(handle, "grip-vertical");
		top.createSpan({ cls: "nsb-number", text: `${t.chapterShort} ${index + 1}` });
		const stageSelect = top.createEl("select", { cls: "nsb-stage", attr: { title: stage.desc[this.lang] } });
		for (const st of stages) stageSelect.createEl("option", { value: st.id, text: st.name[this.lang] });
		stageSelect.value = stage.id;
		stageSelect.onchange = () => {
			ch.stage = stageSelect.value;
			this.commit();
		};

		const title = card.createEl("input", {
			cls: "nsb-title",
			type: "text",
			value: ch.title,
			attr: { placeholder: t.titlePlaceholder },
		});
		title.oninput = () => {
			ch.title = title.value;
			this.commit(false);
		};

		const summary = card.createEl("textarea", { cls: "nsb-summary", attr: { placeholder: stage.desc[this.lang] || t.summaryPlaceholder } });
		summary.value = ch.summary;
		summary.oninput = () => {
			ch.summary = summary.value;
			this.commit(false);
		};

		const footer = card.createDiv("nsb-card-footer");
		const noteFile = ch.note ? this.app.vault.getAbstractFileByPath(ch.note) : null;
		const hasNote = noteFile instanceof TFile;
		const noteBtn = footer.createEl("button", {
			cls: "nsb-note clickable-icon" + (hasNote ? " has-note" : ""),
			attr: { "aria-label": hasNote ? `${noteFile.basename}\n${t.openNote}` : t.createNote },
		});
		setIcon(noteBtn, hasNote ? "file-text" : "file-plus");
		if (hasNote) noteBtn.createSpan({ cls: "nsb-words", attr: { "data-note": noteFile.path } });
		noteBtn.onclick = (e) => this.openNote(ch, index, stage, e);

		footer.createDiv("nsb-spacer");
		this.iconButton(footer, "chevron-left", t.moveLeft, index === 0, () => {
			moveItem(this.board.chapters, index, index - 1);
			this.commit();
		});
		this.iconButton(footer, "chevron-right", t.moveRight, index === this.board.chapters.length - 1, () => {
			moveItem(this.board.chapters, index, index + 1);
			this.commit();
		});
		this.iconButton(footer, "trash-2", t.delete, false, async () => {
			if (!(await confirm(this.app, t.deleteConfirm, t))) return;
			this.board.chapters.splice(index, 1);
			this.commit();
		});

		this.wireDrag(card, handle, ch);
	}

	private iconButton(parent: HTMLElement, icon: string, label: string, disabled: boolean, onClick: () => void) {
		const btn = parent.createEl("button", { cls: "clickable-icon", attr: { "aria-label": label } });
		setIcon(btn, icon);
		btn.disabled = disabled;
		btn.onclick = onClick;
	}

	private wireDrag(card: HTMLElement, handle: HTMLElement, ch: Chapter) {
		const clearMarks = () => card.removeClass("nsb-drop-before", "nsb-drop-after");
		const after = (e: DragEvent) => {
			const r = card.getBoundingClientRect();
			return e.clientX > r.left + r.width / 2;
		};
		handle.ondragstart = (e) => {
			this.dragId = ch.id;
			e.dataTransfer?.setData("text/plain", ch.id);
			e.dataTransfer?.setDragImage(card, 20, 20);
			card.addClass("is-dragging");
		};
		handle.ondragend = () => {
			this.dragId = null;
			card.removeClass("is-dragging");
		};
		card.ondragover = (e) => {
			if (!this.dragId || this.dragId === ch.id) return;
			e.preventDefault();
			const isAfter = after(e);
			card.toggleClass("nsb-drop-after", isAfter);
			card.toggleClass("nsb-drop-before", !isAfter);
		};
		card.ondragleave = clearMarks;
		card.ondrop = (e) => {
			clearMarks();
			const chapters = this.board.chapters;
			const from = chapters.findIndex((c) => c.id === this.dragId);
			if (from < 0 || this.dragId === ch.id) return;
			e.preventDefault();
			let to = chapters.indexOf(ch) + (after(e) ? 1 : 0);
			if (from < to) to--;
			moveItem(chapters, from, to);
			this.commit();
		};
	}

	private async openNote(ch: Chapter, index: number, stage: Stage, evt: MouseEvent) {
		let file = ch.note ? this.app.vault.getAbstractFileByPath(ch.note) : null;
		if (!(file instanceof TFile)) {
			if (!this.file) return;
			const parent = this.file.parent?.path ?? "";
			const folder = normalizePath(parent && parent !== "/" ? `${parent}/${this.file.basename}` : this.file.basename);
			if (!(this.app.vault.getAbstractFileByPath(folder) instanceof TFolder)) {
				await this.app.vault.createFolder(folder);
			}
			const fallback = `${this.plugin.t.chapter} ${index + 1}`;
			const path = normalizePath(`${folder}/${noteFileName(index + 1, ch.title, fallback)}.md`);
			const existing = this.app.vault.getAbstractFileByPath(path);
			file = existing instanceof TFile
				? existing
				: await this.app.vault.create(path, noteTemplate(this.file.path, stage.name[this.lang], ch.title || fallback));
			ch.note = file.path;
			this.commit();
		}
		await this.app.workspace.getLeaf(Keymap.isModEvent(evt) || "tab").openFile(file as TFile);
	}
}

function noteTemplate(boardPath: string, stageName: string, title: string): string {
	return `---\nboard: "[[${boardPath}]]"\nstage: "${stageName}"\n---\n\n# ${title}\n\n`;
}

export function confirm(app: App, message: string, t: { confirm: string; cancel: string }): Promise<boolean> {
	return new Promise((resolve) => {
		let result = false;
		const modal = new Modal(app);
		modal.contentEl.createEl("p", { text: message });
		new Setting(modal.contentEl)
			.addButton((b) => b.setButtonText(t.cancel).onClick(() => modal.close()))
			.addButton((b) =>
				b.setButtonText(t.confirm).setCta().onClick(() => {
					result = true;
					modal.close();
				}),
			);
		modal.onClose = () => resolve(result);
		modal.open();
	});
}
