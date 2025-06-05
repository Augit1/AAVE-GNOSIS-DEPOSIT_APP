import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useAccount, useReadContract, useWaitForTransactionReceipt, useBalance } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { formatUnits, Hash } from 'viem';
import { ERC20_ABI } from './config/abis';
import { AAVE_POOL_ADDRESS } from './config/constants';
import { FaWallet } from 'react-icons/fa';
import { GiPlantSeed } from 'react-icons/gi';
import TokenSelectionModal from './app/components/TokenSelectionModal';
import TimePeriodModal from './app/components/TimePeriodModal';
import ChatInterface from './app/components/ChatInterface';

interface Token {
  address: `0x${string}`;
  decimals: number;
  symbol: string;
  aTokenAddress: `0x${string}`;
}

interface Transaction {
  hash: Hash;
  type: 'deposit' | 'withdraw';
  amount: string;
  status: 'pending' | 'success' | 'error';
  timestamp: number;
}

// Animated count-up hook
function useCountUp(target: number, duration = 1000) {
  const [value, setValue] = useState(0);
  const raf = useRef<number>();
  useLayoutEffect(() => {
    let start: number | null = null;
    function animate(ts: number) {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setValue(target * progress);
      if (progress < 1) raf.current = requestAnimationFrame(animate);
    }
    raf.current = requestAnimationFrame(animate);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration]);
  return value;
}

interface AppProps {
  theme: 'light' | 'dark';
  setTheme: React.Dispatch<React.SetStateAction<'light' | 'dark'>>;
}

function App({ theme, setTheme }: AppProps) {
  const [amount, setAmount] = useState('');
  const [action] = useState<'deposit' | 'withdraw'>('deposit');
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const { address } = useAccount();
  const [selectedToken, setSelectedToken] = useState<Token>({
    address: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    decimals: 18,
    symbol: '',
    aTokenAddress: '0x0000000000000000000000000000000000000000' as `0x${string}`
  });
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [totalWalletValue, setTotalWalletValue] = useState(0);
  const [selectedTimePeriod, setSelectedTimePeriod] = useState('1d');
  const [showTimePeriodModal, setShowTimePeriodModal] = useState(false);
  const [tokenPrice, setTokenPrice] = useState<number | null>(null);
  const [tokenPriceChange, setTokenPriceChange] = useState<number | null>(null);
  const [selectedPricePeriod, setSelectedPricePeriod] = useState<'1h' | '6h' | '24h' | '7d' | '30d'>('24h');
  const [showPricePeriodModal, setShowPricePeriodModal] = useState(false);
  const [availablePricePeriods, setAvailablePricePeriods] = useState<string[]>(['1h', '6h', '24h', '7d', '30d']);

  // Native xDAI balance
  const { data: nativeBalance } = useBalance({
    address,
    query: {
      enabled: selectedToken.symbol === 'XDAI' && !!address,
    },
  });

  // Read user's token balance (ERC20)
  const { 
    data: balance, 
    isError: balanceError,
    error: balanceErrorDetails,
    refetch: refetchBalance
  } = useReadContract({
    address: selectedToken.address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: {
      enabled: !!address && selectedToken.address !== '0x0000000000000000000000000000000000000000' && selectedToken.symbol !== '',
    },
  });

  // Read token allowance
  const { 
    isError: allowanceError,
    error: allowanceErrorDetails,
    refetch: refetchAllowance
  } = useReadContract({
    address: selectedToken.address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address as `0x${string}`, AAVE_POOL_ADDRESS],
    query: {
      enabled: !!address && selectedToken.address !== '0x0000000000000000000000000000000000000000' && selectedToken.symbol !== '',
    },
  });

  // Read user's aToken balance in the pool
  const { 
    refetch: refetchATokenBalance 
  } = useReadContract({
    address: selectedToken.aTokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: {
      enabled: !!address && selectedToken.aTokenAddress !== '0x0000000000000000000000000000000000000000' && selectedToken.symbol !== '',
    },
  });

  // Monitor transaction status
  const { isLoading: isConfirming, isSuccess, isError } = useWaitForTransactionReceipt({
    hash: txHash || undefined,
  });

  // Refetch balances after successful transaction
  useEffect(() => {
    if (isSuccess) {
      refetchATokenBalance();
      setTxStatus('success');
      setAmount('');
      setTxHash(null);
    }
  }, [isSuccess, refetchATokenBalance]);

  // Refetch balances when token changes
  useEffect(() => {
    if (address) {
      refetchBalance();
      refetchAllowance();
      refetchATokenBalance();
    }
  }, [selectedToken.symbol, address, refetchBalance, refetchAllowance, refetchATokenBalance]);

  // Supply goal state (persisted)
  const [supplyGoal] = useState(() => {
    const saved = localStorage.getItem('supplyGoal');
    return saved ? parseFloat(saved) : 1000;
  });

  useEffect(() => {
    if (balanceError) {
      console.error('Error reading balance:', {
        error: balanceErrorDetails,
        token: selectedToken.symbol,
        address: selectedToken.address,
        userAddress: address
      });
    }
    if (allowanceError) {
      console.error('Error reading allowance:', {
        error: allowanceErrorDetails,
        token: selectedToken.symbol,
        address: selectedToken.address,
        userAddress: address
      });
    }
  }, [balanceError, allowanceError, balanceErrorDetails, allowanceErrorDetails, selectedToken, address]);

  useEffect(() => {
    if (isConfirming) {
      setTxStatus('pending');
    } else if (isSuccess) {
      setTxStatus('success');
      setAmount('');
      setTxHash(null);
    } else if (isError) {
      setTxStatus('error');
      setTxHash(null);
    } else if (txStatus !== 'idle') {
      setTxStatus('idle');
    }
  }, [isConfirming, isSuccess, isError, txHash]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.style.setProperty('--rk-colors-connectButtonBackground', 'rgba(30, 41, 59, 0.85)');
      root.style.setProperty('--rk-colors-connectButtonText', '#f8fafc');
    } else {
      root.style.setProperty('--rk-colors-connectButtonBackground', '#fff');
      root.style.setProperty('--rk-colors-connectButtonText', '#1f2937');
    }
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const formatBalance = (balance: bigint | undefined) => {
    if (!balance) return '0.00';
    try {
      return formatUnits(balance, selectedToken.decimals);
    } catch (error) {
      console.error('Error formatting balance:', error);
      return '0.00';
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  // Calculate animated wallet balance
  const walletBalance = selectedToken.symbol === 'XDAI'
    ? (nativeBalance ? parseFloat(nativeBalance.formatted) : 0)
    : (balance ? parseFloat(formatBalance(balance)) : 0);
  const animatedWallet = useCountUp(walletBalance, 1200);

  // Wallet bar: percent of selected token in total wallet value
  const walletPercent = totalWalletValue > 0 ? Math.min(walletBalance / totalWalletValue, 1) : 0;

  // Save supply goal to localStorage
  useEffect(() => {
    localStorage.setItem('supplyGoal', supplyGoal.toString());
  }, [supplyGoal]);

  // Fetch token price and price change when selectedToken or selectedPricePeriod changes
  useEffect(() => {
    async function fetchTokenPrice() {
      if (!selectedToken || !selectedToken.address) {
        setTokenPrice(null);
        setTokenPriceChange(null);
        return;
      }
      const contractAddress = selectedToken.address.toLowerCase();
      let price = null;
      let priceChange = null;
      try {
        const url = `https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.pairs && data.pairs.length > 0) {
          // First try to find the Gnosis pair for price
          const gnosisPair = data.pairs.find((p: any) => p.chainId === 'gnosischain');
          price = gnosisPair?.priceUsd ? parseFloat(gnosisPair.priceUsd) : null;

          // Find the most liquid pair across all chains for price change
          const mostLiquidPair = data.pairs.reduce((best: any, current: any) => {
            const bestLiquidity = best?.liquidity?.usd || 0;
            const currentLiquidity = current?.liquidity?.usd || 0;
            return currentLiquidity > bestLiquidity ? current : best;
          }, null);

          if (mostLiquidPair?.priceChange) {
            const periodMap: Record<string, string> = { '1h': 'h1', '6h': 'h6', '24h': 'h24', '7d': 'd7', '30d': 'd30' };
            const key = periodMap[selectedPricePeriod] || 'h24';
            
            // Get available periods from the price change data
            const availablePeriods = Object.keys(mostLiquidPair.priceChange)
              .map(k => Object.entries(periodMap).find(([_, v]) => v === k)?.[0])
              .filter((p): p is string => p !== undefined);
            
            setAvailablePricePeriods(availablePeriods.length > 0 ? availablePeriods : ['24h']);

            // Try to get price change for selected period
            if (key in mostLiquidPair.priceChange) {
              priceChange = mostLiquidPair.priceChange[key];
            } else {
              // If selected period not available, find the most recent period with data
              const availableKeys = Object.keys(mostLiquidPair.priceChange);
              if (availableKeys.length > 0) {
                // Sort periods by recency (h1 > h6 > h24 > d7 > d30)
                const periodOrder = ['h1', 'h6', 'h24', 'd7', 'd30'];
                const mostRecentKey = availableKeys
                  .sort((a, b) => periodOrder.indexOf(a) - periodOrder.indexOf(b))[0];
                priceChange = mostLiquidPair.priceChange[mostRecentKey];
              }
            }
          }
        }
        setTokenPrice(price || null);
        setTokenPriceChange(priceChange !== null ? Number(priceChange) : null);
      } catch (e) {
        setTokenPrice(null);
        setTokenPriceChange(null);
      }
    }
    fetchTokenPrice();
  }, [selectedToken, selectedPricePeriod]);

  const handleTokenSelect = (token: Token) => {
    setSelectedToken({
      address: token.address as `0x${string}`,
      decimals: token.decimals,
      symbol: token.symbol,
      aTokenAddress: token.aTokenAddress as `0x${string}`
    });
    setShowTokenModal(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background-start to-background-end text-primary">
      {/* Theme Toggle */}
      <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
        {theme === 'light' ? (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        )}
      </button>

      {/* Animated Background */}
      <div className="animated-background">
        <div className="floating-elements">
          <div className="floating-element"></div>
          <div className="floating-element"></div>
          <div className="floating-element"></div>
          <div className="floating-element"></div>
        </div>
      </div>

      {/* Security Shield */}
      <div className="security-shield" title="Secure Transactions"></div>

      <div className="max-w-2xl mx-auto px-4 py-12 relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-primary mb-2 animate-fade-in">
            Aave Assistant
          </h1>
          <p className="text-lg text-secondary animate-fade-in-delayed">
            Your AI-powered DeFi companion
          </p>
        </div>

        {/* Wallet Connection */}
        <div className="flex justify-center mb-8">
          <div className="transform hover:scale-105 transition-transform duration-200">
            <ConnectButton />
          </div>
        </div>

        {/* Animated Balance Cards */}
        {address && (
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-8 w-full">
            {/* Wallet Balance Card */}
            <div className={`glass-growth-card hover-lift relative p-6 rounded-2xl shadow-lg mb-2 border border-blue-400/30 cursor-pointer min-h-[120px] flex flex-col justify-between ${tokenPrice === null ? 'w-full max-w-2xl' : 'w-full max-w-xs'}`} onClick={() => setShowTokenModal(true)} title="Click to select token">
              <div className="flex flex-col items-center flex-1 justify-center">
                <span className="mb-2 text-blue-400 flex items-center gap-2 animate-fade-in">
                  <FaWallet className="text-xl" />
                  <span className="font-medium text-sm tracking-wide">Wallet</span>
                </span>
                <div className="flex items-end justify-center space-x-2">
                  <span className="text-4xl font-semibold text-primary tracking-tight animate-fade-in">
                    {animatedWallet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-lg text-secondary font-medium mb-1">{selectedToken.symbol}</span>
                </div>
                {tokenPrice !== null && (
                  <div className="flex items-center mt-2">
                    <span className="text-lg font-bold text-blue-400">
                      1 {selectedToken.symbol} = {tokenPrice.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}$
                    </span>
                  </div>
                )}
                <div className="tooltip-container w-full mt-4">
                  <div className="progress-bar-container">
                    <div
                      className="progress-bar"
                      style={{
                        width: `${Math.max(walletPercent * 100, 5)}%`,
                        minWidth: '5%',
                        '--progress-start': '#60a5fa',
                        '--progress-end': '#3b82f6'
                      } as React.CSSProperties}
                    />
                  </div>
                  <div className="tooltip-content">
                    <div className="tooltip-arrow" />
                    {totalWalletValue > 0 
                      ? `${Math.round(walletPercent * 100)}% of your total wallet value is in ${selectedToken.symbol}`
                      : 'No tokens in your wallet'}
                  </div>
                </div>
              </div>
            </div>

            {/* Total Value in USD Card */}
            {tokenPrice !== null && (
              <div className="glass-growth-card hover-lift relative w-full max-w-xs p-6 rounded-2xl shadow-lg mb-2 border border-blue-400/30 cursor-pointer min-h-[120px] flex flex-col justify-between" title="Total value of this token in USD" onClick={() => setShowPricePeriodModal(true)}>
                <div className="flex flex-col items-center flex-1 justify-center">
                  <span className="mb-2 text-blue-400 flex items-center gap-2 animate-fade-in">
                    <GiPlantSeed className="text-xl" />
                    <span className="font-medium text-sm tracking-wide">Total Value</span>
                  </span>
                  <div className="flex items-end justify-center space-x-2">
                    <span className="text-4xl font-semibold text-primary tracking-tight animate-fade-in">
                      {tokenPrice !== null && walletBalance !== null
                        ? `$${(tokenPrice * walletBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '--'}
                    </span>
                    <span className="text-lg text-secondary font-medium mb-1">USD</span>
                  </div>
                  <div className="flex items-center mt-2">
                    {tokenPriceChange !== null && (
                      <span className={`text-lg font-bold ${tokenPriceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {tokenPriceChange >= 0 ? '+' : ''}
                        {tokenPriceChange.toFixed(2)}%
                      </span>
                    )}
                  </div>
                  <div className="tooltip-container w-full mt-4">
                    <div className="progress-bar-container">
                      <div
                        className="progress-bar"
                        style={{
                          width: tokenPriceChange !== null ? `${Math.min(Math.abs(tokenPriceChange), 100)}%` : '100%',
                          minWidth: '5%',
                          background: tokenPriceChange !== null
                            ? (tokenPriceChange >= 0
                                ? 'linear-gradient(90deg, #4ade80, #22d3ee)'
                                : 'linear-gradient(90deg, #f87171, #fbbf24)')
                            : 'linear-gradient(90deg, #60a5fa, #3b82f6)'
                        } as React.CSSProperties}
                        title={tokenPrice !== null ? `${tokenPrice.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} $/token` : ''}
                      />
                    </div>
                    <div className="tooltip-content">
                      <div className="tooltip-arrow" />
                      {tokenPriceChange !== null
                        ? `Price ${tokenPriceChange >= 0 ? 'increased' : 'decreased'} by ${tokenPriceChange.toFixed(2)}% over the last ${selectedPricePeriod}`
                        : (tokenPrice !== null && walletBalance !== null
                            ? `You own ${(walletBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${selectedToken.symbol} ≈ $${(tokenPrice * walletBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : 'No price data available')}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chat Interface */}
        <div className="glass-card rounded-2xl p-8 mb-8 bg-opacity-50 border border-blue-400/30 hover-lift">
          <ChatInterface />
        </div>

        {/* Info Section - Fixed at bottom */}
        <div className="fixed bottom-0 left-0 right-0 py-4 bg-opacity-80 backdrop-blur-sm bg-gradient-to-t from-gray-900/10 to-transparent dark:from-gray-900/20">
          <div className="max-w-2xl mx-auto px-4">
            <div className="text-center text-sm text-secondary space-y-1">
              <p className="animate-fade-in">Connected to Gnosis Chain</p>
              <p className="animate-fade-in-delayed">Powered by Aave Protocol</p>
            </div>
          </div>
        </div>

        {/* Token Selection Modal */}
        <TokenSelectionModal
          open={showTokenModal}
          onClose={() => setShowTokenModal(false)}
          onSelect={handleTokenSelect}
          selectedTokenAddress={selectedToken.address}
          theme={theme}
          onTotalValueUpdate={setTotalWalletValue}
        />

        {/* Time Period Modal */}
        <TimePeriodModal
          open={showTimePeriodModal}
          onClose={() => setShowTimePeriodModal(false)}
          onSelect={setSelectedTimePeriod}
          selectedPeriod={selectedTimePeriod}
          theme={theme}
        />

        {/* Price Period Modal */}
        <TimePeriodModal
          open={showPricePeriodModal}
          onClose={() => setShowPricePeriodModal(false)}
          onSelect={(period) => setSelectedPricePeriod(period as typeof selectedPricePeriod)}
          selectedPeriod={selectedPricePeriod}
          theme={theme}
          periods={availablePricePeriods}
        />
      </div>
    </div>
  );
}

export default App;