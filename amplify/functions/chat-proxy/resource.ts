import { defineFunction } from '@aws-amplify/backend';

export const chatProxy = defineFunction({
  name: 'chat-proxy',
  entry: './handler.ts',
  timeoutSeconds: 120,
  memoryMB: 512,
});
