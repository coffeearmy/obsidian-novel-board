// Minimal stand-in for the Obsidian API, enough to render the board and editor for screenshots.
import * as icons from "lucide-static";

type ElOptions = string | { cls?: string | string[]; text?: string; attr?: Record<string, string>; type?: string; value?: string };

function applyOptions(el: HTMLElement, o?: ElOptions) {
	if (!o) return;
	if (typeof o === "string") {
		el.className = o;
		return;
	}
	if (o.cls) el.className = Array.isArray(o.cls) ? o.cls.join(" ") : o.cls;
	if (o.text !== undefined) el.textContent = o.text;
	if (o.attr) for (const [k, v] of Object.entries(o.attr)) el.setAttribute(k, v);
	if (o.type) (el as HTMLInputElement).type = o.type;
	if (o.value !== undefined) (el as HTMLInputElement).value = o.value;
}

const proto = HTMLElement.prototype as any;
proto.createEl = function (tag: string, o?: ElOptions) {
	const el = document.createElement(tag);
	applyOptions(el, o);
	this.appendChild(el);
	return el;
};
proto.createDiv = function (o?: ElOptions) {
	return this.createEl("div", o);
};
proto.createSpan = function (o?: ElOptions) {
	return this.createEl("span", o);
};
proto.empty = function () {
	this.innerHTML = "";
};
proto.setText = function (t: string) {
	this.textContent = t;
};
proto.addClass = function (...c: string[]) {
	this.classList.add(...c);
};
proto.removeClass = function (...c: string[]) {
	this.classList.remove(...c);
};
proto.toggleClass = function (c: string, on: boolean) {
	this.classList.toggle(c, on);
};
proto.toggle = function (show: boolean) {
	this.style.display = show ? "" : "none";
};

export function setIcon(el: HTMLElement, name: string) {
	const key = name.replace(/(^|-)(\w)/g, (_, __, ch: string) => ch.toUpperCase());
	const svg = (icons as Record<string, string>)[key];
	el.insertAdjacentHTML("afterbegin", (svg ?? "").replace('class="lucide', 'class="svg-icon lucide'));
}

export const normalizePath = (p: string) => p.replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
export const moment = { locale: () => "en" };
export const Keymap = { isModEvent: () => false };

export class TFile {
	constructor(public path: string) {}
	get basename() {
		return this.path.split("/").pop()!.replace(/\.[^.]+$/, "");
	}
	parent = { path: "" };
}
export class TFolder {}

export class Notice {
	constructor(_msg: string) {}
}

export class TextFileView {
	app: any;
	contentEl: HTMLElement;
	file: TFile | null = null;
	constructor(public leaf: any) {
		this.app = leaf.app;
		this.contentEl = leaf.contentEl;
	}
	requestSave() {}
	registerEvent() {}
}

export class Modal {
	modalEl: HTMLElement;
	titleEl: HTMLElement;
	contentEl: HTMLElement;
	private containerEl: HTMLElement;
	constructor(public app: any) {
		this.containerEl = document.createElement("div");
		this.containerEl.className = "modal-container mod-dim";
		this.containerEl.createDiv("modal-bg");
		this.modalEl = this.containerEl.createDiv("modal");
		this.modalEl.createDiv("modal-close-button");
		this.titleEl = this.modalEl.createDiv("modal-header").createDiv("modal-title");
		this.contentEl = this.modalEl.createDiv("modal-content");
	}
	open() {
		document.body.appendChild(this.containerEl);
		(this as any).onOpen?.();
	}
	close() {
		this.containerEl.remove();
	}
}

class Component {
	constructor(public el: HTMLElement) {}
}

class ButtonComponent extends Component {
	setButtonText(t: string) {
		this.el.textContent = t;
		return this;
	}
	setCta() {
		this.el.addClass("mod-cta");
		return this;
	}
	setIcon(i: string) {
		setIcon(this.el, i);
		return this;
	}
	setTooltip(t: string) {
		this.el.setAttribute("aria-label", t);
		return this;
	}
	onClick() {
		return this;
	}
}

export class Setting {
	settingEl: HTMLElement;
	private infoEl: HTMLElement;
	private controlEl: HTMLElement;
	constructor(parent: HTMLElement) {
		this.settingEl = parent.createDiv("setting-item");
		this.infoEl = this.settingEl.createDiv("setting-item-info");
		this.controlEl = this.settingEl.createDiv("setting-item-control");
	}
	setName(n: string) {
		this.infoEl.createDiv({ cls: "setting-item-name", text: n });
		return this;
	}
	setDesc(d: string) {
		this.infoEl.createDiv({ cls: "setting-item-description", text: d });
		return this;
	}
	setHeading() {
		this.settingEl.addClass("setting-item-heading");
		return this;
	}
	addText(cb: (c: any) => void) {
		const input = this.controlEl.createEl("input", { type: "text" });
		const c = {
			inputEl: input,
			setValue: (v: string) => ((input.value = v), c),
			setPlaceholder: (p: string) => ((input.placeholder = p), c),
			onChange: () => c,
		};
		cb(c);
		return this;
	}
	addDropdown(cb: (c: any) => void) {
		const select = this.controlEl.createEl("select", "dropdown");
		const c = {
			addOption: (v: string, t: string) => (select.createEl("option", { value: v, text: t }), c),
			setValue: (v: string) => ((select.value = v), c),
			onChange: () => c,
		};
		cb(c);
		return this;
	}
	addButton(cb: (c: ButtonComponent) => void) {
		cb(new ButtonComponent(this.controlEl.createEl("button")));
		return this;
	}
	addExtraButton(cb: (c: ButtonComponent) => void) {
		cb(new ButtonComponent(this.controlEl.createDiv("clickable-icon extra-setting-button")));
		return this;
	}
}

export class Menu {
	private items: { title: string; icon: string }[] = [];
	addItem(cb: (item: any) => void) {
		const entry = { title: "", icon: "" };
		const item = {
			setTitle: (t: string) => ((entry.title = t), item),
			setIcon: (i: string) => ((entry.icon = i), item),
			onClick: () => item,
		};
		cb(item);
		this.items.push(entry);
		return this;
	}
	showAtPosition(pos: { x: number; y: number }) {
		const menu = document.body.createDiv("menu");
		menu.style.cssText = `position:absolute;left:${pos.x}px;top:${pos.y}px;z-index:50`;
		const scroll = menu.createDiv("menu-scroll");
		for (const it of this.items) {
			const row = scroll.createDiv("menu-item tappable");
			setIcon(row.createDiv("menu-item-icon"), it.icon);
			row.createDiv({ cls: "menu-item-title", text: it.title });
		}
	}
	showAtMouseEvent(e: MouseEvent) {
		this.showAtPosition({ x: e.clientX, y: e.clientY });
	}
}

export class Plugin {}
export class PluginSettingTab {}
export type App = any;
export type WorkspaceLeaf = any;
