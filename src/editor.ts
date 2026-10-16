import { App, Modal, Notice, Setting, setIcon } from "obsidian";
import { CustomStructure, PALETTE, cleanCustom, moveAct, moveStage, newStage, nextHue } from "./custom";
import type NovelBoardPlugin from "./main";

export class StructureEditorModal extends Modal {
	private draft: CustomStructure;
	private saved = false;

	constructor(
		app: App,
		private plugin: NovelBoardPlugin,
		initial: CustomStructure,
		private onSave: (structure: CustomStructure) => void,
	) {
		super(app);
		this.draft = JSON.parse(JSON.stringify(initial));
	}

	onOpen() {
		this.modalEl.addClass("nsb-editor-modal");
		this.titleEl.setText(this.plugin.t.editStructure);
		this.renderBody();
	}

	onClose() {
		this.contentEl.empty();
	}

	private renderBody(focus?: string) {
		const t = this.plugin.t;
		const lang = this.plugin.settings.language;
		const el = this.contentEl;
		el.empty();

		new Setting(el).setName(t.name).addText((text) =>
			text.setValue(this.draft.name).setPlaceholder(t.untitled).onChange((v) => (this.draft.name = v)),
		);

		const actsEl = el.createDiv("nsb-editor-acts");
		let number = 0;
		this.draft.acts.forEach((act, ai) => {
			const box = actsEl.createDiv("nsb-editor-act");
			box.style.setProperty("--nsb-hue", String(act.hue));

			const head = box.createDiv("nsb-editor-act-head");
			const actName = head.createEl("input", {
				cls: "nsb-editor-act-name",
				type: "text",
				value: act.name,
				attr: { placeholder: t.actName },
			});
			actName.oninput = () => (act.name = actName.value);
			const swatches = head.createDiv({ cls: "nsb-swatches", attr: { "aria-label": t.color } });
			for (const p of PALETTE) {
				const sw = swatches.createEl("button", {
					cls: "nsb-swatch" + (p.hue === act.hue ? " is-active" : ""),
					attr: { "aria-label": p[lang] },
				});
				sw.style.setProperty("--nsb-hue", String(p.hue));
				sw.onclick = () => {
					act.hue = p.hue;
					this.renderBody();
				};
			}
			this.iconButton(head, "arrow-up", t.moveUp, ai === 0, () => moveAct(this.draft.acts, ai, -1));
			this.iconButton(head, "arrow-down", t.moveDown, ai === this.draft.acts.length - 1, () =>
				moveAct(this.draft.acts, ai, 1),
			);
			this.iconButton(head, "trash-2", t.deleteAct, false, () => this.draft.acts.splice(ai, 1));

			const isFirst = ai === 0;
			const isLast = ai === this.draft.acts.length - 1;
			act.stages.forEach((stage, si) => {
				number++;
				const row = box.createDiv("nsb-editor-stage");
				row.createSpan({ cls: "nsb-editor-num", text: String(number) });
				const fields = row.createDiv("nsb-editor-fields");
				const name = fields.createEl("input", {
					cls: "nsb-editor-stage-name",
					type: "text",
					value: stage.name,
					attr: { placeholder: t.stageName, "data-stage": stage.id },
				});
				name.oninput = () => (stage.name = name.value);
				const desc = fields.createEl("input", {
					cls: "nsb-editor-stage-desc",
					type: "text",
					value: stage.desc,
					attr: { placeholder: t.stageDesc },
				});
				desc.oninput = () => (stage.desc = desc.value);
				this.iconButton(row, "arrow-up", t.moveUp, isFirst && si === 0, () => moveStage(this.draft.acts, ai, si, -1));
				this.iconButton(row, "arrow-down", t.moveDown, isLast && si === act.stages.length - 1, () =>
					moveStage(this.draft.acts, ai, si, 1),
				);
				this.iconButton(row, "x", t.deleteStage, false, () => act.stages.splice(si, 1));
			});

			const addStage = box.createEl("button", { cls: "nsb-editor-add", text: "+ " + t.addStage });
			addStage.onclick = () => {
				const stage = newStage();
				act.stages.push(stage);
				this.renderBody(stage.id);
			};
		});

		const addAct = el.createEl("button", { cls: "nsb-editor-add-act", text: "+ " + t.addAct });
		addAct.onclick = () => {
			const stage = newStage();
			this.draft.acts.push({ name: "", hue: nextHue(this.draft.acts), stages: [stage] });
			this.renderBody(stage.id);
		};

		el.createEl("p", { cls: "nsb-editor-hint", text: t.editorHint });

		new Setting(el)
			.addButton((b) => b.setButtonText(t.cancel).onClick(() => this.close()))
			.addButton((b) => b.setButtonText(t.save).setCta().onClick(() => this.save()));

		if (focus) el.querySelector<HTMLInputElement>(`[data-stage="${focus}"]`)?.focus();
	}

	private iconButton(parent: HTMLElement, icon: string, label: string, disabled: boolean, onClick: () => void) {
		const btn = parent.createEl("button", { cls: "clickable-icon", attr: { "aria-label": label } });
		setIcon(btn, icon);
		btn.disabled = disabled;
		btn.onclick = () => {
			onClick();
			this.renderBody();
		};
	}

	private save() {
		if (this.saved) return;
		const clean = cleanCustom(this.draft, this.plugin.t.untitled);
		if (!clean) {
			new Notice(this.plugin.t.needStage);
			return;
		}
		this.saved = true;
		this.onSave(clean);
		this.close();
	}
}
