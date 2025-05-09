export const GNOSIS_CHAIN_ID = 100;

export const TOKENS = {
  USDC: {
    address: '0x2a22f9c3b484c3629090FeED35F17Ff8F88f76F0' as `0x${string}`,
    decimals: 6,
    symbol: 'USDC.e',
    aTokenAddress: '0xC0333cb85B59a788d8C7CAe5e1Fd6E229A3E5a65' as `0x${string}`
  },
  DAI: {
    address: '0x44fA8E6f479873398506d7E61B375C6a34a7Dc4C' as `0x${string}`,
    decimals: 18,
    symbol: 'DAI',
  },
};

export const AAVE_POOL_ADDRESS = '0xb50201558B00496A145fE76f7424749556E326D8' as `0x${string}`;

export const SUPPORTED_CHAINS = [
  {
    id: GNOSIS_CHAIN_ID,
    name: 'Gnosis Chain',
    network: 'gnosis',
    nativeCurrency: {
      name: 'xDAI',
      symbol: 'xDAI',
      decimals: 18,
    },
    rpcUrls: {
      default: { http: ['https://rpc.gnosischain.com'] },
      public: { http: ['https://rpc.gnosischain.com'] },
    },
    blockExplorers: {
      default: { name: 'GnosisScan', url: 'https://gnosisscan.io' },
    },
  },
]; 