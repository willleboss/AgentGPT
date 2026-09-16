import { App, normalizePath, TFile } from "obsidian";
import { SavSettings } from "./settings";
import { Fc2Connector } from "./connectors/fc2";
import { PraxedoConnector } from "./connectors/praxedo";
import { GoPaasConnector } from "./connectors/gopaas";
import { SavTicket, Fc2Ticket } from "./connectors/types";

export class SyncEngine {
	constructor(private readonly app: App, private readonly settings: SavSettings) {}

	async syncAll(log: (msg: string) => void): Promise<{ fc2Count: number; maintainerCount: number }> {
		const fc2 = new Fc2Connector(this.settings.fc2, this.settings.debugShowBrowser);
		const praxedo = new PraxedoConnector(this.settings.praxedo, this.settings.debugShowBrowser);
		const gopaas = new GoPaasConnector(this.settings.gopaas, this.settings.debugShowBrowser);

		try {
			log("Connexion à FC2…");
			await fc2.login();
			log("Connexion à R&C (Praxedo)…");
			await praxedo.login();
			log("Connexion à Circet (GoPaaS)…");
			await gopaas.login();

			log("Lecture des tickets FC2…");
			const fc2Tickets = await fc2.listTickets();

			log("Lecture des interventions R&C…");
			const rcTickets = await praxedo.listTickets();

			log("Lecture des interventions Circet…");
			const circetTickets = await gopaas.listTickets();

			const maintainerTickets = [...rcTickets, ...circetTickets];

			log("Mise à jour des notes de suivi…");
			for (const ticket of fc2Tickets) {
				const match = maintainerTickets.find((t) => t.id === ticket.id);
				await this.upsertNote(ticket, match);
			}

			return { fc2Count: fc2Tickets.length, maintainerCount: maintainerTickets.length };
		} finally {
			fc2.dispose();
			praxedo.dispose();
			gopaas.dispose();
		}
	}

	private async ensureFolder(path: string): Promise<void> {
		if (!this.app.vault.getAbstractFileByPath(path)) {
			try {
				await this.app.vault.createFolder(path);
			} catch (e) {
				// le dossier existe déjà (course possible entre plusieurs tickets) : on ignore.
			}
		}
	}

	private async upsertNote(fc2Ticket: Fc2Ticket, maintainerTicket?: SavTicket): Promise<void> {
		const folder = normalizePath(this.settings.notesFolder);
		await this.ensureFolder(folder);

		const path = normalizePath(`${folder}/${sanitizeFileName(fc2Ticket.id)}.md`);
		const existing = this.app.vault.getAbstractFileByPath(path);
		const now = new Date().toISOString();

		const frontmatter = [
			"---",
			`ticket_id: "${fc2Ticket.id}"`,
			`mainteneur: "${fc2Ticket.maintainer}"`,
			`statut_fc2: "${fc2Ticket.status}"`,
			`statut_mainteneur: "${maintainerTicket?.status ?? "inconnu"}"`,
			`derniere_sync: "${now}"`,
			"---",
			"",
		].join("\n");

		const annotationsText = maintainerTicket?.annotations?.length
			? ` — ${maintainerTicket.annotations.join(" | ")}`
			: "";
		const logLine = `- ${now} — FC2: **${fc2Ticket.status}** / ${fc2Ticket.maintainer}: **${
			maintainerTicket?.status ?? "inconnu"
		}**${annotationsText}`;

		if (existing instanceof TFile) {
			const content = await this.app.vault.read(existing);
			const body = content.replace(/^---[\s\S]*?---\n*/, "");
			await this.app.vault.modify(existing, frontmatter + body + "\n" + logLine + "\n");
		} else {
			const header = `## Suivi SAV ${fc2Ticket.id}\n\n`;
			await this.app.vault.create(path, frontmatter + header + logLine + "\n");
		}
	}
}

function sanitizeFileName(name: string): string {
	return name.replace(/[\\/:*?"<>|]/g, "-");
}
