import { App, PluginSettingTab, Setting } from "obsidian";
import type SavFiberCenterPlugin from "./main";

export interface SiteCredentials {
	baseUrl: string;
	username: string;
	password: string;
}

export interface SavSettings {
	fc2: SiteCredentials;
	praxedo: SiteCredentials;
	gopaas: SiteCredentials;
	notesFolder: string;
	debugShowBrowser: boolean;
}

export const DEFAULT_SETTINGS: SavSettings = {
	fc2: {
		baseUrl: "https://newfibercenter.lumiere.fr",
		username: "",
		password: "",
	},
	praxedo: {
		baseUrl: "https://rcgroupe.praxedo.com",
		username: "",
		password: "",
	},
	gopaas: {
		baseUrl: "https://circet-fr.gopaas.net",
		username: "",
		password: "",
	},
	notesFolder: "SAV FTTH",
	debugShowBrowser: false,
};

export class SavSettingTab extends PluginSettingTab {
	plugin: SavFiberCenterPlugin;

	constructor(app: App, plugin: SavFiberCenterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "SAV FiberCenter Tracker" });

		const warning = containerEl.createEl("div");
		warning.style.border = "1px solid var(--text-error)";
		warning.style.borderRadius = "6px";
		warning.style.padding = "10px";
		warning.style.marginBottom = "16px";
		warning.createEl("strong", { text: "⚠️ Sécurité : " });
		warning.createSpan({
			text:
				"les identifiants ci-dessous sont enregistrés en clair dans le fichier " +
				".obsidian/plugins/sav-fibercenter-tracker/data.json de ce vault. " +
				"N'utilisez pas de vault synchronisé sur un service tiers non maîtrisé, et ne committez jamais " +
				"ce fichier dans un dépôt git. Réservé à un usage professionnel autorisé sur des comptes " +
				"dont vous disposez déjà légitimement.",
		});

		containerEl.createEl("h3", { text: "FC2 — FiberCenter (outil interne)" });
		this.addSiteSettings(containerEl, this.plugin.settings.fc2);

		containerEl.createEl("h3", { text: "R&C — Praxedo" });
		this.addSiteSettings(containerEl, this.plugin.settings.praxedo);

		containerEl.createEl("h3", { text: "Circet — GoPaaS" });
		this.addSiteSettings(containerEl, this.plugin.settings.gopaas);

		containerEl.createEl("h3", { text: "Général" });

		new Setting(containerEl)
			.setName("Dossier des notes de suivi")
			.setDesc("Dossier du vault où seront créées/mises à jour les notes de suivi SAV.")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.notesFolder)
					.onChange(async (value) => {
						this.plugin.settings.notesFolder = value || DEFAULT_SETTINGS.notesFolder;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Mode debug (afficher le navigateur)")
			.setDesc(
				"Affiche la fenêtre de navigation utilisée pour se connecter aux sites, avec les DevTools ouverts. " +
					"Utile pour trouver les vrais sélecteurs de champs/boutons de chaque site avant de finaliser les connecteurs."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.debugShowBrowser)
					.onChange(async (value) => {
						this.plugin.settings.debugShowBrowser = value;
						await this.plugin.saveSettings();
					})
			);
	}

	private addSiteSettings(containerEl: HTMLElement, creds: SiteCredentials): void {
		new Setting(containerEl)
			.setName("URL")
			.addText((text) =>
				text.setValue(creds.baseUrl).onChange(async (value) => {
					creds.baseUrl = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Identifiant")
			.addText((text) =>
				text.setValue(creds.username).onChange(async (value) => {
					creds.username = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl).setName("Mot de passe").addText((text) => {
			text.inputEl.type = "password";
			text.setValue(creds.password).onChange(async (value) => {
				creds.password = value;
				await this.plugin.saveSettings();
			});
		});
	}
}
