import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@fontsource/anton/400.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
