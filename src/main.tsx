import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import '@/app/app.css';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Root element #root was not found.');
}

createRoot(rootElement).render(<App />);
