import { Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, SavSettings, SavSettingTab } from "./settings";
import { SyncEngine } from "./sync";

export default class SavFiberCenterPlugin extends Plugin {
	settings: SavSettings;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new SavSettingTab(this.app, this));

		this.addRibbonIcon("refresh-cw", "Synchroniser les SAV FTTH", () => {
			void this.runSync();
		});

		this.addCommand({
			id: "sav-sync-now",
			name: "Synchroniser les tickets SAV (FC2 + mainteneurs)",
			callback: () => {
				void this.runSync();
			},
		});
	}

	onunload(): void {
		// rien à nettoyer : chaque synchronisation gère son propre cycle de vie.
	}

	private async runSync(): Promise<void> {
		if (!this.credentialsConfigured()) {
			new Notice(
				"SAV FiberCenter : configurez d'abord les identifiants FC2 / R&C / Circet dans les réglages du plugin.",
				6000
			);
			return;
		}

		const notice = new Notice("Synchronisation SAV en cours…", 0);
		const engine = new SyncEngine(this.app, this.settings);
		try {
			const result = await engine.syncAll((msg) => notice.setMessage(msg));
			notice.setMessage(
				`Synchronisation SAV terminée ✅ (${result.fc2Count} tickets FC2, ${result.maintainerCount} interventions mainteneurs)`
			);
		} catch (e) {
			console.error("SAV FiberCenter sync error", e);
			notice.setMessage(`Erreur de synchronisation SAV : ${(e as Error).message}`);
		} finally {
			setTimeout(() => notice.hide(), 6000);
		}
	}

	private credentialsConfigured(): boolean {
		return Boolean(
			this.settings.fc2.username &&
				this.settings.fc2.password &&
				this.settings.praxedo.username &&
				this.settings.praxedo.password &&
				this.settings.gopaas.username &&
				this.settings.gopaas.password
		);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
