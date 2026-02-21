import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito';
import { CookieStorage } from 'aws-amplify/utils';
import outputs from '../amplify_outputs.json';
import { setBackendUrls } from './lib/api';
import './index.css';
import App from './App.jsx';

// Required to complete OIDC redirect sign-in
import 'aws-amplify/auth/enable-oauth-listener';

Amplify.configure(outputs);

// Store Cognito tokens in cookies instead of localStorage.
// Note: true httpOnly cookies require server-side setting — not possible
// with client-side auth. These are secure cookies with sameSite protection.
cognitoUserPoolsTokenProvider.setKeyValueStorage(
  new CookieStorage({
    domain: window.location.hostname,
    path: '/',
    expires: 30,
    secure: window.location.protocol === 'https:',
    sameSite: 'lax',
  })
);

// Register custom API endpoints from Amplify outputs
const custom = outputs.custom || {};
const apiEndpoint = custom.API?.ChatApi?.endpoint || '';
const streamUrl = custom.StreamUrl || '';
setBackendUrls(apiEndpoint, streamUrl);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
