export type Maintainer = "R&C" | "Circet";

export interface SavTicket {
	id: string;
	maintainer: Maintainer;
	status: string;
	lastUpdate?: string;
	annotations: string[];
	raw?: unknown;
}

export interface MaintainerConnector {
	readonly name: string;
	login(): Promise<void>;
	listTickets(): Promise<SavTicket[]>;
	dispose(): void;
}

export interface Fc2Ticket {
	id: string;
	status: string;
	maintainer: string;
	raw?: unknown;
}
