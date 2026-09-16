/**
 * Enveloppe une fenêtre Electron cachée (session cookies isolée par site) pour
 * piloter un site authentifié sans se heurter aux restrictions CORS d'un simple
 * fetch() depuis le processus de rendu d'Obsidian.
 *
 * Nécessite Obsidian desktop (Electron). Ne fonctionne pas sur mobile.
 */

function getRemote(): typeof import("@electron/remote") {
	try {
		// @electron/remote est initialisé par Obsidian desktop lui-même ;
		// les plugins peuvent le requérir directement au runtime.
		return (window as unknown as { require: (m: string) => typeof import("@electron/remote") }).require(
			"@electron/remote"
		);
	} catch (e) {
		throw new Error(
			"Impossible de charger '@electron/remote'. Ce plugin nécessite Obsidian desktop (pas la version mobile)."
		);
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export class BrowserSession {
	private win: import("electron").BrowserWindow | null = null;
	private readonly partition: string;

	constructor(siteKey: string, private readonly debugVisible: boolean) {
		this.partition = `persist:sav-fibercenter-${siteKey}`;
	}

	private ensureWindow(): import("electron").BrowserWindow {
		if (this.win && !this.win.isDestroyed()) return this.win;
		const { BrowserWindow } = getRemote();
		const win = new BrowserWindow({
			show: this.debugVisible,
			width: 1280,
			height: 900,
			webPreferences: {
				partition: this.partition,
				nodeIntegration: false,
				contextIsolation: true,
			},
		});
		if (this.debugVisible) {
			win.webContents.openDevTools({ mode: "detach" });
		}
		this.win = win;
		return win;
	}

	async goto(url: string, waitMs = 1500): Promise<void> {
		const win = this.ensureWindow();
		await win.loadURL(url);
		await sleep(waitMs);
	}

	/** Exécute un script dans la page chargée et retourne son résultat sérialisable. */
	async run<T>(script: string): Promise<T> {
		const win = this.ensureWindow();
		return win.webContents.executeJavaScript(script, true) as Promise<T>;
	}

	async currentUrl(): Promise<string> {
		const win = this.ensureWindow();
		return win.webContents.getURL();
	}

	/** Attend qu'une condition sur l'URL courante soit vraie (utile pour confirmer une redirection post-login). */
	async waitForUrl(matcher: (url: string) => boolean, timeoutMs = 8000, intervalMs = 300): Promise<string> {
		const start = Date.now();
		let url = await this.currentUrl();
		while (Date.now() - start < timeoutMs) {
			url = await this.currentUrl();
			if (matcher(url)) return url;
			await sleep(intervalMs);
		}
		return url;
	}

	dispose(): void {
		if (this.win && !this.win.isDestroyed()) {
			this.win.close();
		}
		this.win = null;
	}
}
