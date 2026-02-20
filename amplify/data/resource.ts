import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  UserSettings: a
    .model({
      endpoint: a.string(),
      apiKey: a.string(),
      systemPrompt: a.string(),
      maxTokens: a.integer().default(4096),
      temperature: a.float().default(1),
      selectedModel: a.string(),
    })
    .authorization((allow) => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
