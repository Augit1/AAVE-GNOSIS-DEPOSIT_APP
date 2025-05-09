import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
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

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
} 