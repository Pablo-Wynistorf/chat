import { defineAuth, secret } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true, // Required by Cognito, but we won't expose it in the UI
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
            custom: {
              'custom:roles': 'roles',
            },
          },
        },
      ],
      callbackUrls: [
        'http://localhost:5173/',
        'https://localhost:5173/',
        'https://main.drd5ypo0d287q.amplifyapp.com/',
        'https://chat.onedns.ch/',
      ],
      logoutUrls: [
        'http://localhost:5173/',
        'https://localhost:5173/',
        'https://main.drd5ypo0d287q.amplifyapp.com/',
        'https://chat.onedns.ch/',
      ],
    },
  },
});
