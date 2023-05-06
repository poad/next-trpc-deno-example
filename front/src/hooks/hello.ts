'use client';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/react-query';
import { useCallback, useState } from 'react';
import { AppRouter } from '../../../lambda';

const url = process.env.NEXT_PUBLIC_API_URL || '';

const client = createTRPCProxyClient<AppRouter>({
  links: [httpBatchLink({ url })],
});

export const useHello = () => {
  const [greeting, setGreeting] = useState<string>();
  const fetch = useCallback(async (text: string) => {
    const hello = await client.hello.query({ text });
    setGreeting(hello.greeting);
  }, []);

  return { greeting, fetch };
};
