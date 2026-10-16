export type Lang = "en" | "es";
export type L10n = Record<Lang, string>;

export interface Stage {
	id: string;
	name: L10n;
	desc: L10n;
	hue: number;
	group: number;
}

export interface StageGroup {
	name?: L10n;
	hue: number;
	stages: Omit<Stage, "hue" | "group">[];
}

export interface Structure {
	id: string;
	name: L10n;
	groups: StageGroup[];
	stages: Stage[];
}

const s = (id: string, en: string, es: string, descEn: string, descEs: string) => ({
	id,
	name: { en, es },
	desc: { en: descEn, es: descEs },
});

// Stages in the same group share a hue family, shifted a little so neighbours stay distinguishable.
export function structure(id: string, name: L10n, groups: StageGroup[]): Structure {
	const stages: Stage[] = [];
	groups.forEach((g, gi) => {
		const n = g.stages.length;
		// At most ±18° so big acts stay in one color family.
		const step = n > 1 ? Math.min(9, 36 / (n - 1)) : 0;
		g.stages.forEach((st, i) => {
			stages.push({ ...st, group: gi, hue: Math.round((g.hue + (i - (n - 1) / 2) * step + 360) % 360) });
		});
	});
	return { id, name, groups, stages };
}

export const STRUCTURES: Structure[] = [
	structure("heros-journey", { en: "Hero's Journey", es: "El viaje del héroe" }, [
		{
			name: { en: "Act I · Departure", es: "Acto I · Partida" },
			hue: 45,
			stages: [
				s("ordinary-world", "Ordinary World", "El mundo ordinario",
					"The hero's normal life before the adventure. What do they lack?",
					"La vida cotidiana del héroe antes de la aventura. ¿Qué le falta?"),
				s("call", "Call to Adventure", "La llamada a la aventura",
					"A problem or challenge disrupts the ordinary world.",
					"Un problema o desafío rompe el mundo ordinario."),
				s("refusal", "Refusal of the Call", "El rechazo de la llamada",
					"Fear or doubt makes the hero hesitate.",
					"El miedo o la duda hacen que el héroe se resista."),
				s("mentor", "Meeting the Mentor", "El encuentro con el mentor",
					"Someone gives advice, training or a gift.",
					"Alguien le da consejo, entrenamiento o un regalo."),
				s("threshold", "Crossing the First Threshold", "El cruce del primer umbral",
					"The hero commits and enters the special world.",
					"El héroe se compromete y entra en el mundo especial."),
			],
		},
		{
			name: { en: "Act II · Initiation", es: "Acto II · Iniciación" },
			hue: 340,
			stages: [
				s("tests", "Tests, Allies, Enemies", "Pruebas, aliados y enemigos",
					"The hero learns the rules of the new world.",
					"El héroe aprende las reglas del nuevo mundo."),
				s("approach", "Approach to the Inmost Cave", "Acercamiento a la caverna más profunda",
					"Preparing for the biggest challenge.",
					"Preparativos ante el mayor desafío."),
				s("ordeal", "The Ordeal", "La odisea",
					"A life-or-death crisis; the hero faces their greatest fear.",
					"Crisis de vida o muerte; el héroe se enfrenta a su mayor miedo."),
				s("reward", "Reward", "La recompensa",
					"The hero survives and seizes the sword (prize, knowledge, love).",
					"El héroe sobrevive y obtiene la espada (premio, saber, amor)."),
			],
		},
		{
			name: { en: "Act III · Return", es: "Acto III · Regreso" },
			hue: 150,
			stages: [
				s("road-back", "The Road Back", "El camino de regreso",
					"Consequences chase the hero on the way home.",
					"Las consecuencias persiguen al héroe en el regreso."),
				s("resurrection", "Resurrection", "La resurrección",
					"Final test; the hero is reborn, transformed.",
					"Prueba final; el héroe renace transformado."),
				s("elixir", "Return with the Elixir", "El regreso con el elixir",
					"The hero brings something that changes the ordinary world.",
					"El héroe trae algo que transforma el mundo ordinario."),
			],
		},
	]),

	structure("save-the-cat", { en: "Save the Cat", es: "Salva al gato" }, [
		{
			name: { en: "Act 1", es: "Acto 1" },
			hue: 45,
			stages: [
				s("opening-image", "Opening Image", "Imagen de apertura",
					"A snapshot of the hero's world and flaw before the change.",
					"Una instantánea del mundo y el defecto del héroe antes del cambio."),
				s("theme-stated", "Theme Stated", "Tema expuesto",
					"Someone hints at the lesson the hero must learn.",
					"Alguien insinúa la lección que el héroe debe aprender."),
				s("setup", "Set-Up", "Planteamiento",
					"Hero, stakes, goal and what needs fixing in their life.",
					"Héroe, lo que está en juego, su meta y lo que debe arreglar."),
				s("catalyst", "Catalyst", "Catalizador",
					"The life-changing event that kicks off the story.",
					"El suceso que cambia la vida del héroe y arranca la historia."),
				s("debate", "Debate", "Debate",
					"The hero hesitates: should I go?",
					"El héroe duda: ¿debo hacerlo?"),
			],
		},
		{
			name: { en: "Act 2A", es: "Acto 2A" },
			hue: 200,
			stages: [
				s("break-into-two", "Break into Two", "Paso al segundo acto",
					"The hero decides and enters the upside-down world.",
					"El héroe decide y entra en un mundo al revés."),
				s("b-story", "B Story", "Trama B",
					"A secondary story (often love or friendship) carrying the theme.",
					"Una trama secundaria (amor, amistad) que encarna el tema."),
				s("fun-and-games", "Fun and Games", "Juegos y diversión",
					"The promise of the premise: the hero explores the new world.",
					"La promesa de la premisa: el héroe explora el nuevo mundo."),
				s("midpoint", "Midpoint", "Punto medio",
					"False victory or false defeat; the stakes rise.",
					"Falsa victoria o falsa derrota; lo que está en juego aumenta."),
			],
		},
		{
			name: { en: "Act 2B", es: "Acto 2B" },
			hue: 330,
			stages: [
				s("bad-guys", "Bad Guys Close In", "Los malos se acercan",
					"External pressure and internal doubts tighten.",
					"La presión externa y las dudas internas aprietan."),
				s("all-is-lost", "All Is Lost", "Todo está perdido",
					"The lowest point; something or someone dies.",
					"El punto más bajo; algo o alguien muere."),
				s("dark-night", "Dark Night of the Soul", "Noche oscura del alma",
					"The hero wallows, then finds the truth.",
					"El héroe se hunde y luego descubre la verdad."),
			],
		},
		{
			name: { en: "Act 3", es: "Acto 3" },
			hue: 140,
			stages: [
				s("break-into-three", "Break into Three", "Paso al tercer acto",
					"A new idea, born of A and B stories, shows the way.",
					"Una nueva idea, fruto de las tramas A y B, abre el camino."),
				s("finale", "Finale", "Final",
					"The hero applies the lesson and defeats the problem.",
					"El héroe aplica la lección y vence el problema."),
				s("final-image", "Final Image", "Imagen final",
					"Mirror of the opening image: proof of change.",
					"Espejo de la imagen de apertura: prueba del cambio."),
			],
		},
	]),

	structure("three-act", { en: "Three-Act Structure", es: "Estructura en tres actos" }, [
		{
			name: { en: "Act I · Setup", es: "Acto I · Planteamiento" },
			hue: 45,
			stages: [
				s("exposition", "Exposition", "Exposición",
					"Characters, world and status quo.",
					"Personajes, mundo y situación inicial."),
				s("inciting-incident", "Inciting Incident", "Detonante",
					"The event that sets the story in motion.",
					"El suceso que pone la historia en marcha."),
				s("plot-point-1", "First Plot Point", "Primer punto de giro",
					"The hero commits; no way back.",
					"El protagonista se compromete; no hay vuelta atrás."),
			],
		},
		{
			name: { en: "Act II · Confrontation", es: "Acto II · Nudo" },
			hue: 335,
			stages: [
				s("rising-action", "Rising Action", "Acción ascendente",
					"Obstacles grow; the hero tries and fails.",
					"Los obstáculos crecen; el protagonista lo intenta y falla."),
				s("midpoint", "Midpoint", "Punto medio",
					"A revelation or reversal changes the direction.",
					"Una revelación o giro cambia la dirección."),
				s("plot-point-2", "Second Plot Point", "Segundo punto de giro",
					"Crisis: everything seems lost; forces a final choice.",
					"Crisis: todo parece perdido; obliga a una decisión final."),
			],
		},
		{
			name: { en: "Act III · Resolution", es: "Acto III · Desenlace" },
			hue: 150,
			stages: [
				s("climax", "Climax", "Clímax",
					"The decisive confrontation.",
					"El enfrentamiento decisivo."),
				s("resolution", "Resolution", "Resolución",
					"The new normal after the conflict.",
					"La nueva normalidad tras el conflicto."),
			],
		},
	]),

	structure("seven-point", { en: "Seven-Point Structure", es: "Estructura de siete puntos" }, [
		{ hue: 48, stages: [s("hook", "Hook", "Gancho",
			"Starting state, the opposite of the resolution.",
			"Situación inicial, opuesta a la resolución.")] },
		{ hue: 25, stages: [s("plot-turn-1", "Plot Turn 1", "Primer giro",
			"Something introduces the conflict and moves the story.",
			"Algo introduce el conflicto y mueve la historia.")] },
		{ hue: 0, stages: [s("pinch-1", "Pinch Point 1", "Primer punto de presión",
			"Pressure from the antagonist forces action.",
			"La presión del antagonista obliga a actuar.")] },
		{ hue: 330, stages: [s("midpoint", "Midpoint", "Punto medio",
			"The hero moves from reacting to acting.",
			"El protagonista pasa de reaccionar a actuar.")] },
		{ hue: 275, stages: [s("pinch-2", "Pinch Point 2", "Segundo punto de presión",
			"More pressure; the plan fails, mentor lost.",
			"Más presión; el plan falla, se pierde al mentor.")] },
		{ hue: 205, stages: [s("plot-turn-2", "Plot Turn 2", "Segundo giro",
			"The hero gets the last piece needed to win.",
			"El protagonista obtiene la última pieza para vencer.")] },
		{ hue: 150, stages: [s("resolution", "Resolution", "Resolución",
			"The climax and the end state.",
			"El clímax y la situación final.")] },
	]),

	structure("freytag", { en: "Freytag's Pyramid", es: "Pirámide de Freytag" }, [
		{ hue: 48, stages: [s("exposition", "Exposition", "Exposición",
			"Background, characters and setting.",
			"Antecedentes, personajes y escenario.")] },
		{ hue: 20, stages: [s("rising-action", "Rising Action", "Acción ascendente",
			"Complications build tension.",
			"Las complicaciones aumentan la tensión.")] },
		{ hue: 345, stages: [s("climax", "Climax", "Clímax",
			"The turning point, peak of the conflict.",
			"El punto de inflexión, cumbre del conflicto.")] },
		{ hue: 260, stages: [s("falling-action", "Falling Action", "Acción descendente",
			"Consequences of the climax unfold.",
			"Se despliegan las consecuencias del clímax.")] },
		{ hue: 170, stages: [s("denouement", "Denouement", "Desenlace",
			"Loose ends tied; catastrophe or resolution.",
			"Se atan cabos; catástrofe o resolución.")] },
	]),

	structure("kishotenketsu", { en: "Kishōtenketsu", es: "Kishōtenketsu" }, [
		{ hue: 48, stages: [s("ki", "Ki · Introduction", "Ki · Introducción",
			"Introduce characters and world.",
			"Presenta personajes y mundo.")] },
		{ hue: 120, stages: [s("sho", "Shō · Development", "Shō · Desarrollo",
			"Develop them, without major conflict.",
			"Los desarrolla, sin gran conflicto.")] },
		{ hue: 335, stages: [s("ten", "Ten · Twist", "Ten · Giro",
			"An unexpected element recontextualizes everything.",
			"Un elemento inesperado lo recontextualiza todo.")] },
		{ hue: 205, stages: [s("ketsu", "Ketsu · Conclusion", "Ketsu · Conclusión",
			"Reconcile the twist with what came before.",
			"Reconcilia el giro con lo anterior.")] },
	]),
];

let custom: Structure[] = [];

/** Registers the user's custom structures so boards can use them like built-ins. */
export function setCustomStructures(list: Structure[]): void {
	custom = list.filter((st) => st.stages.length > 0);
}

export function allStructures(): Structure[] {
	return [...STRUCTURES, ...custom];
}

export function isCustom(id: string): boolean {
	return custom.some((st) => st.id === id);
}

export function getStructure(id: string): Structure {
	return allStructures().find((st) => st.id === id) ?? STRUCTURES[0];
}
