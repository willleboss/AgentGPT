import { BrowserSession } from "./browserSession";
import { Fc2Ticket } from "./types";
import { SiteCredentials } from "../settings";

/**
 * FC2 — FiberCenter (outil interne, SPA à routage hash `#/tickets`).
 *
 * Pilote une fenêtre Electron cachée pour se connecter, lire la liste des
 * tickets, puis déclencher/clôturer un SAV via son formulaire.
 * Les sélecteurs ci-dessous sont des placeholders génériques — à ajuster avec
 * le mode debug (réglages du plugin) une fois la vraie page inspectée.
 */
export class Fc2Connector {
	readonly name = "FiberCenter (FC2)";
	private session: BrowserSession;

	constructor(private readonly creds: SiteCredentials, debugVisible: boolean) {
		this.session = new BrowserSession("fc2", debugVisible);
	}

	async login(): Promise<void> {
		// FC2 redirige vers #/accueil après une connexion réussie (confirmé en usage réel) ;
		// on part de la racine plutôt que de deviner l'URL exacte du formulaire de connexion.
		await this.session.goto(this.creds.baseUrl, 2000);
		await this.session.run(`
			(function () {
				const user = document.querySelector('input[name="username"], input[type="email"], #username');
				const pass = document.querySelector('input[name="password"], input[type="password"], #password');
				if (!user || !pass) {
					throw new Error('Formulaire de connexion FC2 introuvable — sélecteurs à ajuster (mode debug).');
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
		const finalUrl = await this.session.waitForUrl(
			(url) => url.includes("#/accueil") || url.includes("#/tickets"),
			8000
		);
		if (!finalUrl.includes("#/accueil") && !finalUrl.includes("#/tickets")) {
			throw new Error(
				`Connexion FC2 : pas de redirection vers #/accueil après 8s (URL actuelle : ${finalUrl}) — sélecteurs ou flux de connexion à vérifier (mode debug).`
			);
		}
	}

	async listTickets(): Promise<Fc2Ticket[]> {
		// L'accueil FC2 (#/accueil) n'affiche pas les tickets : il faut naviguer explicitement vers #/tickets.
		await this.session.goto(`${this.creds.baseUrl}/#/tickets`, 2500);
		// TODO : FC2 est probablement une SPA adossée à une API JSON — inspecter
		// l'onglet Network en mode debug pour appeler directement cette API
		// plutôt que de parser le DOM (plus rapide et plus robuste).
		const rows = await this.session.run<Array<{ cells: (string | null)[] }>>(`
			(function () {
				const trs = Array.from(document.querySelectorAll('table tbody tr, [data-testid="ticket-row"]'));
				return trs.map((row) => ({
					cells: Array.from(row.querySelectorAll('td, [data-testid]')).map((td) => (td.textContent || '').trim()),
				}));
			})();
		`);

		return (rows || [])
			.filter((r) => r.cells && r.cells.length > 0)
			.map((r, i) => ({
				id: r.cells[0] || `fc2-${i}`,
				status: r.cells[1] || "inconnu",
				maintainer: r.cells[2] || "inconnu",
				raw: r,
			}));
	}

	/** Déclenche un SAV sur le ticket donné. */
	async declencherSav(ticketId: string, note: string): Promise<void> {
		await this.session.goto(`${this.creds.baseUrl}/#/tickets/${encodeURIComponent(ticketId)}`, 2000);
		await this.session.run(`
			(function () {
				// TODO : remplacer par les vrais sélecteurs du bouton "Déclencher SAV"
				// et du champ note/commentaire sur la fiche ticket FC2.
				const btn = document.querySelector('[data-action="declencher-sav"], button.declencher-sav');
				if (!btn) throw new Error('declencherSav: sélecteur du bouton à compléter pour FC2.');
				btn.click();
				const noteField = document.querySelector('textarea[name="note"], textarea[name="commentaire"]');
				if (noteField) {
					noteField.value = ${JSON.stringify(note)};
					noteField.dispatchEvent(new Event('input', { bubbles: true }));
				}
				const confirm = document.querySelector('[data-action="confirmer"], button[type="submit"]');
				if (confirm) confirm.click();
			})();
		`);
	}

	/** Clôture un SAV sur le ticket donné avec un statut final et une annotation. */
	async cloturerSav(ticketId: string, statutFinal: string, note: string): Promise<void> {
		await this.session.goto(`${this.creds.baseUrl}/#/tickets/${encodeURIComponent(ticketId)}`, 2000);
		await this.session.run(`
			(function () {
				// TODO : remplacer par les vrais sélecteurs du formulaire de clôture SAV
				// (sélection du statut final + champ annotation) sur la fiche ticket FC2.
				const btn = document.querySelector('[data-action="cloturer-sav"], button.cloturer-sav');
				if (!btn) throw new Error('cloturerSav: sélecteur du bouton à compléter pour FC2.');
				btn.click();
				const statusField = document.querySelector('select[name="statut"]');
				if (statusField) {
					statusField.value = ${JSON.stringify(statutFinal)};
					statusField.dispatchEvent(new Event('change', { bubbles: true }));
				}
				const noteField = document.querySelector('textarea[name="note"], textarea[name="commentaire"]');
				if (noteField) {
					noteField.value = ${JSON.stringify(note)};
					noteField.dispatchEvent(new Event('input', { bubbles: true }));
				}
				const confirm = document.querySelector('[data-action="confirmer"], button[type="submit"]');
				if (confirm) confirm.click();
			})();
		`);
	}

	dispose(): void {
		this.session.dispose();
	}
}
