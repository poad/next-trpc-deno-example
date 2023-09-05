import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../lambda/index";
export const trpc = createTRPCReact<AppRouter>();
