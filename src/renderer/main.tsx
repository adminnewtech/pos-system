import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { initCapacitorAdapterAndBuild } from './capacitor-adapter';

// Initialize Capacitor SQLite adapter before rendering
initCapacitorAdapterAndBuild()
  .then(() => console.log('POS initialized'))
  .catch(err => console.error('POS init error:', err));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
