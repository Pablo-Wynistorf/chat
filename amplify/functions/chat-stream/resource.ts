import { defineFunction } from '@aws-amplify/backend';

export const chatStream = defineFunction({
  name: 'chat-stream',
  entry: './handler.ts',
  timeoutSeconds: 300,
  memoryMB: 512,
});
