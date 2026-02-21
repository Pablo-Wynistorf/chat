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
      mcpServers: a.string(), // JSON-stringified array of MCP server configs
    })
    .authorization((allow) => [allow.owner()]),

  Chat: a
    .model({
      title: a.string().required(),
      created: a.float().required(),
    })
    .authorization((allow) => [allow.owner()]),

  ChatMessage: a
    .model({
      chatId: a.string().required(),
      sortKey: a.float().required(),
      role: a.string().required(),
      content: a.string().required(),
      fileContent: a.string(),
      files: a.string(),
    })
    .secondaryIndexes((index) => [
      index('chatId').sortKeys(['sortKey']).queryField('messagesByChatId'),
    ])
    .authorization((allow) => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
