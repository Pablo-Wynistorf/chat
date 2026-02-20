import { defineAuth, secret } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      oidc: [
        {
          name: 'OneIdp',
          clientId: secret('ONEIDP_CLIENT_ID'),
          clientSecret: secret('ONEIDP_CLIENT_SECRET'),
          issuerUrl: 'https://oneidp.ch',
          scopes: ['openid', 'email', 'profile'],
          attributeMapping: {
            email: 'email',
          },
        },
      ],
      callbackUrls: ['http://localhost:5173/', 'https://localhost:5173/'],
      logoutUrls: ['http://localhost:5173/', 'https://localhost:5173/'],
    },
  },
});
