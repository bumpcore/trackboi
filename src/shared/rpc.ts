import type { Card, CardPatch, ProjectRegistry, ProjectSnapshot, WindowFrame } from "./types";

export type TrackboiRPCSchema = {
	bun: {
		requests: {
			getActiveProject: {
				params: undefined;
				response: ProjectSnapshot | null;
			};
			listProjects: {
				params: undefined;
				response: ProjectRegistry;
			};
			chooseProject: {
				params: undefined;
				response: ProjectSnapshot | null;
			};
			switchProject: {
				params: {
					projectId: string;
				};
				response: ProjectSnapshot | null;
			};
			createCard: {
				params: {
					title: string;
					description?: string;
					column: string;
				};
				response: Card;
			};
			updateCard: {
				params: {
					cardId: string;
					patch: CardPatch;
				};
				response: Card;
			};
			moveCard: {
				params: {
					cardId: string;
					toColumn: string;
					beforeCardId?: string | null;
				};
				response: Card;
			};
			deleteCard: {
				params: {
					cardId: string;
				};
				response: { ok: true };
			};
			minimizeWindow: {
				params: undefined;
				response: { ok: true };
			};
			toggleMaximizeWindow: {
				params: undefined;
				response: { ok: true };
			};
			closeWindow: {
				params: undefined;
				response: { ok: true };
			};
			getWindowFrame: {
				params: undefined;
				response: WindowFrame;
			};
			setWindowFrame: {
				params: WindowFrame;
				response: { ok: true };
			};
		};
		messages: Record<never, never>;
	};
	webview: {
		requests: Record<never, never>;
		messages: {
			boardChanged: ProjectSnapshot | null;
		};
	};
};
