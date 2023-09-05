import * as trpc from "@trpc/server";
import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda";
import type { CreateAWSLambdaContextOptions } from "@trpc/server/adapters/aws-lambda";
import { APIGatewayProxyEvent } from "aws-lambda";
import { z } from "zod";

function createContext({
	event,
	context,
}: CreateAWSLambdaContextOptions<APIGatewayProxyEvent>) {
	return {
		event,
		context,
		apiVersion: (event as { version?: string }).version || "1.0",
	};
}

type Context = trpc.inferAsyncReturnType<typeof createContext>;

const t = trpc.initTRPC.context<Context>().create();

const procedure = t.procedure;
const router = t.router;

const appRouter = router({
	hello: procedure
		.input(
			z.object({
				text: z.string(),
			}),
		)
		.query(({ input }) => {
			return {
				greeting: `hello ${input.text}`,
			};
		}),
});

export type AppRouter = typeof appRouter;

export const handler = awsLambdaRequestHandler({
	router: appRouter,
	createContext,
	responseMeta() {
		return {
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Request-Method": "*",
				"Access-Control-Allow-Methods": "OPTIONS, GET, POST",
				"Access-Control-Allow-Headers": "*",
				"Content-Type": "application/json; charset=UTF-8",
			},
		};
	},
});
