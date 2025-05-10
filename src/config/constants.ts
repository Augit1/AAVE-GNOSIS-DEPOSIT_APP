export const GNOSIS_CHAIN_ID = 100;

export const TOKENS = {
  USDC: {
    address: '0x2a22f9c3b484c3629090FeED35F17Ff8F88f76F0' as `0x${string}`,
    decimals: 6,
    symbol: 'USDC.e',
    aTokenAddress: '0xC0333cb85B59a788d8C7CAe5e1Fd6E229A3E5a65' as `0x${string}`
  },
  XDAI: {
    address: '0x3ce36eA2AFd0f92b64D0014c6386Ac178D1133cc' as `0x${string}`,
    decimals: 18,
    symbol: 'xDAI',
    aTokenAddress: '0x87a1fdc4C726c459f597282be639a045062c0E46' as `0x${string}`
  },
  WETH: {
    address: '0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1' as `0x${string}`,
    decimals: 18,
    symbol: 'WETH',
    aTokenAddress: '0x9c402E3b0D123323F0FCed781b8184Ec7E02Dd31' as `0x${string}`
  },
  USDT: {
    address: '0x4ECaBa5870353805a9F068101A40E0f32ed605C6' as `0x${string}`,
    decimals: 6,
    symbol: 'USDT',
    aTokenAddress: '0x6344B5542F3D70B6dE06560B6C5bD1d730c2aB5E' as `0x${string}`
  },
  LINK: {
    address: '0xE2e73A1c69ecF83F464EFCE6A5be353a37cA09b2' as `0x${string}`,
    decimals: 18,
    symbol: 'LINK',
    aTokenAddress: '0x5Ddff25B7a9E8E5f9bD4c6FE9232626F3CC2a4a2' as `0x${string}`
  },
  WBTC: {
    address: '0x8e5bBbb09Ed1ebdE8674Cda39A0c169401db4252' as `0x${string}`,
    decimals: 8,
    symbol: 'WBTC',
    aTokenAddress: '0x8A458A9dc9048e006d6c2F1B6C8aC48f9795a9d5' as `0x${string}`
  },
  GNO: {
    address: '0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb' as `0x${string}`,
    decimals: 18,
    symbol: 'GNO',
    aTokenAddress: '0x7Ef541E2a22058048904fE5744f9c7E4C57AF717' as `0x${string}`
  }
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