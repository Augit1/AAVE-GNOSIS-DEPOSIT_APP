import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt, useBalance } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseUnits, formatUnits, Hash } from 'viem';
import { AAVE_POOL_ABI, ERC20_ABI } from './config/abis';
import { AAVE_POOL_ADDRESS, TOKENS } from './config/constants';
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

const GNOSIS_BLOCKSCOUT_API = 'https://gnosis.blockscout.com/api';
const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const CORS_PROXY = 'https://api.allorigins.win/get?url=';

// Map of token addresses to CoinGecko IDs
const TOKEN_TO_COINGECKO: { [key: string]: string } = {
  '0x2a22f9c3b484c3629090feed35f17ff8f88f76f0': 'usd-coin', // USDC
  '0x3ce36ea2afd0f92b64d0014c6386ac178d1133cc': 'xdai', // xDAI
  '0x6a023ccd1ff6f2045c3309768ead9e68f978f6e1': 'weth', // WETH
  '0x4ecaba5870353805a9f068101a40e0f32ed605c6': 'tether', // USDT
  '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d': 'wrapped-xdai', // WXDAI
  '0x9c58bacc331c9aa871afd802db6379a98e80cedb': 'gnosis', // GNO
  '0x6c76971f98945ae98dd7d4dfca8711ebea946ea6': 'weth', // WETH
  '0x1509706a6c66ca549ff0cb464de88231ddbe213b': 'weth', // WETH
};

// Rate limiting helper
const rateLimiter = {
  lastRequest: 0,
  minInterval: 12000, // Increased to 12 seconds to avoid rate limits
  async wait() {
    const now = Date.now();
    const timeToWait = Math.max(0, this.minInterval - (now - this.lastRequest));
    if (timeToWait > 0) {
      await new Promise(resolve => setTimeout(resolve, timeToWait));
    }
    this.lastRequest = Date.now();
  }
};

function App({ theme, setTheme }: AppProps) {
  const [amount, setAmount] = useState('');
  const [action, setAction] = useState<'deposit' | 'withdraw'>('deposit');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('transactions');
    return saved ? JSON.parse(saved) : [];
  });
  const [showHistory, setShowHistory] = useState(false);
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
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
  const [tokenGrowth, setTokenGrowth] = useState<number>(0);

  // Native xDAI balance
  const { data: nativeBalance, isLoading: isNativeBalanceLoading } = useBalance({
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
    isLoading: isBalanceLoading,
    refetch: refetchBalance
  } = useReadContract({
    address: selectedToken.address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: {
      enabled: !!address && selectedToken.address !== '0x0000000000000000000000000000000000000000',
    },
  });

  // Read token allowance
  const { 
    data: allowance, 
    isError: allowanceError,
    error: allowanceErrorDetails,
    refetch: refetchAllowance
  } = useReadContract({
    address: selectedToken.address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address as `0x${string}`, AAVE_POOL_ADDRESS],
    query: {
      enabled: !!address && selectedToken.address !== '0x0000000000000000000000000000000000000000',
    },
  });

  // Read user's aToken balance in the pool
  const { 
    data: aTokenBalance, 
    isLoading: isATokenLoading, 
    isError: isATokenError,
    refetch: refetchATokenBalance 
  } = useReadContract({
    address: selectedToken.aTokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: {
      enabled: !!address && selectedToken.aTokenAddress !== '0x0000000000000000000000000000000000000000',
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
  const [supplyGoal, setSupplyGoal] = useState(() => {
    const saved = localStorage.getItem('supplyGoal');
    return saved ? parseFloat(saved) : 1000;
  });
  const [showGoalCard, setShowGoalCard] = useState(false);

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
      setIsLoading(false);
      // Add transaction to history
      if (txHash) {
        setTransactions(prev => [{
          hash: txHash,
          type: action,
          amount,
          status: 'success',
          timestamp: Date.now(),
        }, ...prev]);
      }
      setTxHash(null);
    } else if (isError) {
      setTxStatus('error');
      setIsLoading(false);
      // Add failed transaction to history
      if (txHash) {
        setTransactions(prev => [{
          hash: txHash,
          type: action,
          amount,
          status: 'error',
          timestamp: Date.now(),
        }, ...prev]);
      }
      setTxHash(null);
    } else if (txStatus !== 'idle') {
      setTxStatus('idle');
    }
  }, [isConfirming, isSuccess, isError, txHash, action, amount]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !address) return;

    setIsLoading(true);
    setError(null);
    setTxHash(null);
    setTxStatus('pending');

    try {
      const amountInWei = parseUnits(amount as `${number}`, selectedToken.decimals);

      // Check balance
      if (action === 'deposit') {
        if (balance && amountInWei > BigInt(balance)) {
          throw new Error('Insufficient wallet balance');
        }
      } else if (action === 'withdraw') {
        if (aTokenBalance && amountInWei > BigInt(aTokenBalance)) {
          throw new Error('Insufficient supplied balance');
        }
      }

      if (action === 'deposit') {
        // Check allowance
        if (allowance && amountInWei > BigInt(allowance)) {
          // First approve the Aave Pool to spend tokens
          const approveResult = await writeContractAsync({
            address: selectedToken.address,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [AAVE_POOL_ADDRESS, amountInWei],
          });
          setTxHash(approveResult);

          // Wait for approval transaction to be confirmed
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }

        // Then deposit
        const depositResult = await writeContractAsync({
          address: AAVE_POOL_ADDRESS,
          abi: AAVE_POOL_ABI,
          functionName: 'supply',
          args: [selectedToken.address, amountInWei, address, 0],
        });
        setTxHash(depositResult);
      } else {
        // Withdraw
        const withdrawResult = await writeContractAsync({
          address: AAVE_POOL_ADDRESS,
          abi: AAVE_POOL_ABI,
          functionName: 'withdraw',
          args: [selectedToken.address, amountInWei, address],
        });
        setTxHash(withdrawResult);
      }
    } catch (err: any) {
      // User-friendly error handling
      let userMessage = 'Something went wrong. Please try again.';
      if (err?.message?.includes('User denied transaction signature')) {
        userMessage = 'Transaction cancelled.';
      } else if (err?.message?.toLowerCase().includes('insufficient balance')) {
        userMessage = 'Insufficient balance.';
      } else if (err?.message?.toLowerCase().includes('insufficient allowance')) {
        userMessage = 'Insufficient allowance. Please approve the token.';
      }
      setError(userMessage);
      setTxStatus('error');
      setIsLoading(false);
      setAmount('');
      setTxHash(null);
      // Log technical details for debugging
      console.error('Transaction error (details):', err);
    } finally {
      setIsLoading(false);
    }
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

  // Calculate supplied progress
  const supplied = aTokenBalance ? parseFloat(formatBalance(aTokenBalance)) : 0;
  const animatedSupplied = useCountUp(supplied, 1200);
  const growthPercent = supplyGoal > 0 ? Math.min(animatedSupplied / supplyGoal, 1) : 0;

  // Wallet bar: percent of selected token in total wallet value
  const walletPercent = totalWalletValue > 0 ? Math.min(walletBalance / totalWalletValue, 1) : 0;

  // Save supply goal to localStorage
  useEffect(() => {
    localStorage.setItem('supplyGoal', supplyGoal.toString());
  }, [supplyGoal]);

  // Persist transactions to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('transactions', JSON.stringify(transactions));
  }, [transactions]);

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
            <div className="glass-growth-card hover-lift relative w-full max-w-xs p-6 rounded-2xl shadow-lg mb-2 border border-blue-400/30 cursor-pointer" onClick={() => setShowTokenModal(true)} title="Click to select token">
              <div className="flex flex-col items-center">
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

            {/* Growth Card (replacing Supplied Balance Card) */}
            <div className="glass-growth-card hover-lift relative w-full max-w-xs p-6 rounded-2xl shadow-lg mb-2 border border-blue-400/30 cursor-pointer" onClick={() => setShowTimePeriodModal(true)} title="Click to select time period">
              <div className="flex flex-col items-center">
                <span className="mb-2 text-blue-400 flex items-center gap-2 animate-fade-in">
                  <GiPlantSeed className="text-xl" />
                  <span className="font-medium text-sm tracking-wide">Wallet Allocation</span>
                </span>
                <div className="flex items-end justify-center space-x-2">
                  <span className="text-4xl font-semibold text-primary tracking-tight animate-fade-in">
                    {Math.round(walletPercent * 100)}%
                  </span>
                </div>
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
          </div>
        )}

        {/* Chat Interface */}
        <div className="glass-card rounded-2xl p-8 mb-8 bg-opacity-50 border border-blue-400/30 hover-lift">
          <ChatInterface theme={theme} />
        </div>

        {/* Transaction History */}
        {showHistory && transactions.length > 0 && (
          <div className="glass-card rounded-2xl p-6 mb-8 animate-fade-in shadow-xl z-20" style={{ marginBottom: '80px' }}>
            <h2 className="text-xl font-semibold text-primary mb-4">Transaction History</h2>
            <div className="space-y-4">
              {transactions.map((tx) => (
                <div
                  key={tx.hash}
                  className="glass-card flex items-center justify-between p-4 rounded-xl bg-opacity-50 shadow-md"
                >
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-3 ${
                      tx.status === 'success' ? 'bg-green-500' :
                      tx.status === 'error' ? 'bg-red-500' :
                      'bg-blue-500'
                    }`}></div>
                    <div>
                      <p className="text-primary font-medium">
                        {tx.type === 'deposit' ? 'Deposit' : 'Withdraw'} {tx.amount} {selectedToken.symbol}
                      </p>
                      <p className="text-sm text-secondary">{formatDate(tx.timestamp)}</p>
                    </div>
                  </div>
                  <a
                    href={`https://gnosisscan.io/tx/${tx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600 transition-colors duration-200"
                  >
                    View on Explorer
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

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
      </div>
    </div>
  );
}

export default App;