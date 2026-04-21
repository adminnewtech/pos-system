import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { initCapacitorAdapter } from './capacitor-adapter';

// Check if we're in Capacitor (Android) vs Electron
const isCapacitor = window.location.protocol === 'file:' ||
  document.location.href.includes('android') ||
  !window.require;

// For Capacitor/Android, initialize the IndexedDB adapter
if (isCapacitor) {
  initCapacitorAdapter().then(() => {
    console.log('POS initialized in Capacitor mode');
  }).catch(err => {
    console.error('Failed to initialize Capacitor adapter:', err);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
