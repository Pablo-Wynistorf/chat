import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';
import { setBackendUrls } from './lib/api';
import './index.css';
import App from './App.jsx';

// Required to complete OIDC redirect sign-in
import 'aws-amplify/auth/enable-oauth-listener';

Amplify.configure(outputs);

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
