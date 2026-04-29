import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { ToastProvider } from './components/Toast';
import { AuthProvider } from './lib/auth-context';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

const savedTheme = (() => {
  try {
    return localStorage.getItem('smartattend.theme') ?? 'system';
  } catch {
    return 'system';
  }
})();
if (savedTheme === 'dark') document.documentElement.classList.add('dark');
else if (savedTheme === 'light') document.documentElement.classList.remove('dark');
else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
  document.documentElement.classList.add('dark');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
