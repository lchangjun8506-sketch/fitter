import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@fontsource/anton/400.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './index.css';

// 안드로이드 크롬: 저장 공간이 부족해도 운동 기록이 자동 삭제되지 않도록 요청
navigator.storage?.persist?.().catch(() => {});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
