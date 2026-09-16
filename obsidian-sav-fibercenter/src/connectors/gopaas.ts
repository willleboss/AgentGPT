import { BrowserSession } from "./browserSession";
import { MaintainerConnector, SavTicket } from "./types";
import { SiteCredentials } from "../settings";

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Circet — GoPaaS (application interne, probablement en PHP à session cookie).
 *
 * Comme pour Praxedo, les sélecteurs ci-dessous sont des placeholders génériques.
 * Activez le mode debug dans les réglages du plugin pour observer la vraie page
 * (formulaire de connexion, tableau des SAV) et ajuster ce fichier en conséquence.
 */
export class GoPaasConnector implements MaintainerConnector {
	readonly name = "Circet (GoPaaS)";
	private session: BrowserSession;

	constructor(private readonly creds: SiteCredentials, debugVisible: boolean) {
		this.session = new BrowserSession("gopaas", debugVisible);
	}

	async login(): Promise<void> {
		await this.session.goto(`${this.creds.baseUrl}/sav/index.php`);
		await this.session.run(`
			(function () {
				const user = document.querySelector('input[name="login"], input[name="username"], input[type="email"]');
				const pass = document.querySelector('input[name="password"], input[type="password"]');
				if (!user || !pass) {
					throw new Error('Formulaire de connexion GoPaaS introuvable — sélecteurs à ajuster (mode debug).');
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
		// TODO : ajuster le sélecteur du tableau des SAV Circet (repérer via mode debug).
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
				id: r.cells[0] || `circet-${i}`,
				maintainer: "Circet" as const,
				status: r.cells[1] || "inconnu",
				annotations: r.cells.slice(2).filter((c): c is string => !!c),
				raw: r,
			}));
	}

	dispose(): void {
		this.session.dispose();
	}
}
