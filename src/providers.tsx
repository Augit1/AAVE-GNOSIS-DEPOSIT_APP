import { RainbowKitProvider, getDefaultConfig, darkTheme, lightTheme, Theme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { gnosis } from 'viem/chains';
import '@rainbow-me/rainbowkit/styles.css';

// Log environment variables for verification
console.log('App Name:', import.meta.env.VITE_APP_NAME);
console.log('WalletConnect Project ID:', import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID);

const config = getDefaultConfig({
  appName: import.meta.env.VITE_APP_NAME || 'Aave Deposit App',
  projectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || '',
  chains: [gnosis],
});

const queryClient = new QueryClient();

const customDarkTheme: Theme = {
  ...darkTheme(),
  colors: {
    ...darkTheme().colors,
    connectButtonBackground: 'rgba(36,41,46,0.75)', // lighter, glassy, translucid
    connectButtonText: '#f8fafc',
  },
};

export function Providers({ children, theme }: { children: React.ReactNode, theme: 'light' | 'dark' }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={theme === 'dark'
            ? customDarkTheme
            : lightTheme({
                accentColor: '#3b82f6',
                accentColorForeground: '#fff',
              })
          }
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
} 