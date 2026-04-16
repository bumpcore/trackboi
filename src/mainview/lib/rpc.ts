import { Electroview } from "electrobun/view";
import type { TrackboiRPCSchema } from "../../shared/rpc";

export const rpc = Electroview.defineRPC<TrackboiRPCSchema>({
	maxRequestTime: 10_000,
	handlers: {
		requests: {},
		messages: {},
	},
});

export const electroview = new Electroview({ rpc });

