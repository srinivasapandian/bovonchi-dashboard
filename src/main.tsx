import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { Store } from './redux/store';
import { fetchWithNetworkError } from './utils/apiNetworkError';
import './index.css';
import App from './App';

// The ported catalog services call global fetch; route it through the shared network-error normaliser.
globalThis.fetch = fetchWithNetworkError;

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Provider store={Store}>
      <App />
    </Provider>
  </React.StrictMode>,
);
