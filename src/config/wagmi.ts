import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { gnosis } from 'viem/chains'

export const config = getDefaultConfig({
  appName: 'Aave Gnosis Deposit App',
  projectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || '',
  chains: [gnosis],
}) 