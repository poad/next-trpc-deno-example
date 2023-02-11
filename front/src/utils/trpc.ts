import { createReactQueryHooks } from '@trpc/react';
import type { AppRouter } from '../../../lambda/index';
export const trpc = createReactQueryHooks<AppRouter>();
