import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import 'leaflet/dist/leaflet.css';
import './main.css';

const rootEl = document.getElementById('root');

if (!rootEl) {
  throw new Error('Root element with id="root" not found');
}

createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
