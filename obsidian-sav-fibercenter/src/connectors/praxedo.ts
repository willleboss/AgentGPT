import { BrowserSession } from "./browserSession";
import { MaintainerConnector, SavTicket } from "./types";
import { SiteCredentials } from "../settings";

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * R&C — Praxedo (logiciel FSM en SaaS).
 *
 * IMPORTANT : Praxedo propose une API REST officielle documentée (authentification
 * par clé API) sur la plupart des instances. Si R&C peut vous fournir un accès API,
 * remplacez cette implémentation par de simples appels HTTP (voir `requestUrl` de
 * l'API Obsidian) — ce sera bien plus fiable et rapide qu'un pilotage de page.
 * Demandez à votre interlocuteur R&C/Praxedo si un accès "API v2" existe pour
 * votre compte avant de vous reposer sur le scraping ci-dessous.
 *
 * En attendant, ce connecteur pilote une fenêtre Electron cachée : les sélecteurs
 * de formulaire (connexion) et de tableau (liste des interventions) sont des
 * placeholders génériques. Activez le mode debug dans les réglages du plugin
 * pour observer la vraie page, ouvrir les DevTools et ajuster les sélecteurs
 * ci-dessous en conséquence.
 */
export class PraxedoConnector implements MaintainerConnector {
	readonly name = "R&C (Praxedo)";
	private session: BrowserSession;

	constructor(private readonly creds: SiteCredentials, debugVisible: boolean) {
		this.session = new BrowserSession("praxedo", debugVisible);
	}

	async login(): Promise<void> {
		await this.session.goto(this.creds.baseUrl);
		await this.session.run(`
			(function () {
				const user = document.querySelector('input[name="username"], input[type="email"], #username');
				const pass = document.querySelector('input[name="password"], input[type="password"], #password');
				if (!user || !pass) {
					throw new Error('Formulaire de connexion Praxedo introuvable — sélecteurs à ajuster (mode debug).');
				}
				user.value = ${JSON.stringify(this.creds.username)};
				pass.value = ${JSON.stringify(this.creds.password)};
				user.dispatchEvent(new Event('input', { bubbles: true }));
				pass.dispatchEvent(new Event('input', { bubbles: true }));
				const form = pass.closest('form');
				const submit = form ? form.querySelector('button[type="submit"], input[type="submit"]') : null;
				if (submit) submit.click();
				else if (form) form.submit();
			})();
		`);
		await sleep(2500);
	}

	async listTickets(): Promise<SavTicket[]> {
		// TODO : remplacer par le vrai endpoint/écran listant les interventions SAV FTTH
		// pour votre compte R&C (repérer l'appel réseau en mode debug, ou l'écran de tableau).
		const rows = await this.session.run<Array<{ cells: (string | null)[] }>>(`
			(function () {
				const trs = Array.from(document.querySelectorAll('table tbody tr'));
				return trs.map((row) => ({
					cells: Array.from(row.querySelectorAll('td')).map((td) => (td.textContent || '').trim()),
				}));
			})();
		`);

		return (rows || [])
			.filter((r) => r.cells && r.cells.length > 0)
			.map((r, i) => ({
				id: r.cells[0] || `praxedo-${i}`,
				maintainer: "R&C" as const,
				status: r.cells[1] || "inconnu",
				annotations: r.cells.slice(2).filter((c): c is string => !!c),
				raw: r,
			}));
	}

	dispose(): void {
		this.session.dispose();
	}
}
