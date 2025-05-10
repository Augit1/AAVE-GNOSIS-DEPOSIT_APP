import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt, useBalance } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseUnits, formatUnits, Hash } from 'viem';
import { AAVE_POOL_ABI, ERC20_ABI } from './config/abis';
import { AAVE_POOL_ADDRESS, TOKENS } from './config/constants';
import { FaWallet } from 'react-icons/fa';
import { GiPlantSeed } from 'react-icons/gi';
import TokenSelectionModal from './app/components/TokenSelectionModal';

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
  const [selectedTokenKey, setSelectedTokenKey] = useState<string>("USDC");
  const [showTokenModal, setShowTokenModal] = useState(false);
  const selectedToken = (TOKENS as any)[selectedTokenKey];

  // Native xDAI balance
  const { data: nativeBalance, isLoading: isNativeBalanceLoading } = useBalance({
    address,
    query: {
      enabled: selectedTokenKey === 'XDAI' && !!address,
    },
  });

  // Read user's token balance (ERC20)
  const { 
    data: balance, 
    isError: balanceError,
    error: balanceErrorDetails,
    isLoading: isBalanceLoading 
  } = useReadContract({
    address: selectedToken.address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: selectedTokenKey !== 'XDAI' && !!address,
      refetchInterval: 5000,
      retry: 3,
    },
  });

  // Read token allowance
  const { 
    data: allowance, 
    isError: allowanceError,
    error: allowanceErrorDetails 
  } = useReadContract({
    address: selectedToken.address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, AAVE_POOL_ADDRESS] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000,
      retry: 3,
    },
  });

  // Read user's aToken (aGnoUSDCe) balance in the pool
  const { 
    data: aTokenBalance, 
    isLoading: isATokenLoading, 
    isError: isATokenError,
    refetch: refetchATokenBalance 
  } = useReadContract({
    address: selectedToken.aTokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000,
      retry: 3,
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
  const walletBalance = selectedTokenKey === 'XDAI'
    ? (nativeBalance ? parseFloat(nativeBalance.formatted) : 0)
    : (balance ? parseFloat(formatBalance(balance)) : 0);
  const animatedWallet = useCountUp(walletBalance, 1200);

  // Calculate supplied progress
  const supplied = aTokenBalance ? parseFloat(formatBalance(aTokenBalance)) : 0;
  const animatedSupplied = useCountUp(supplied, 1200);
  const growthPercent = supplyGoal > 0 ? Math.min(animatedSupplied / supplyGoal, 1) : 0;

  // Wallet bar: percent of USDC.e not supplied
  const totalUSDC = walletBalance + supplied;
  const walletPercent = totalUSDC > 0 ? Math.min(walletBalance / totalUSDC, 1) : 0;

  // Save supply goal to localStorage
  useEffect(() => {
    localStorage.setItem('supplyGoal', supplyGoal.toString());
  }, [supplyGoal]);

  // Persist transactions to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('transactions', JSON.stringify(transactions));
  }, [transactions]);

  return (
    <div className="min-h-screen relative">
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
            Aave Deposit
          </h1>
          <p className="text-lg text-secondary animate-fade-in-delayed">
            Secure deposits and withdrawals on Gnosis Chain
          </p>
        </div>

        {/* Wallet Connection */}
        <div className="flex justify-center mb-8">
          <div className="transform hover:scale-105 transition-transform duration-200">
            <ConnectButton />
          </div>
        </div>

        {/* Animated Balance Cards - Apple-like, visually differentiated */}
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
                {/* Wallet progress bar with tooltip */}
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
                    {totalUSDC > 0 
                      ? `${Math.round(walletPercent * 100)}% of your total USDC.e is in your wallet`
                      : 'No USDC.e in your wallet'}
                  </div>
                </div>
              </div>
            </div>
            {/* Supplied Balance Card */}
            <div
              className="glass-growth-card hover-lift relative w-full max-w-xs p-6 rounded-2xl shadow-lg mb-2 border border-green-400/30 cursor-pointer"
              onClick={() => setShowGoalCard(true)}
              title="Click to set your supply goal"
            >
              <div className="flex flex-col items-center">
                <span className="mb-2 text-green-400 flex items-center gap-2 animate-fade-in">
                  <GiPlantSeed className="text-xl" />
                  <span className="font-medium text-sm tracking-wide">Supplied</span>
                </span>
                <div className="flex items-end justify-center space-x-2">
                  <span className="text-4xl font-semibold text-primary tracking-tight animate-fade-in">
                    {animatedSupplied.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-lg text-secondary font-medium mb-1">{selectedToken.symbol}</span>
                </div>
                {/* Supply progress bar with tooltip */}
                <div className="tooltip-container w-full mt-4">
                  <div className="progress-bar-container">
                    <div
                      className="progress-bar"
                      style={{
                        width: `${Math.max(growthPercent * 100, 5)}%`,
                        minWidth: '5%',
                        '--progress-start': '#34d399',
                        '--progress-end': '#10b981'
                      } as React.CSSProperties}
                    />
                  </div>
                  <div className="tooltip-content">
                    <div className="tooltip-arrow" />
                    {supplyGoal > 0
                      ? `${Math.round(growthPercent * 100)}% of your ${supplyGoal.toLocaleString()} USDC.e supply goal`
                      : 'Set a supply goal to track your progress'}
                  </div>
                </div>
              </div>
              {isATokenError && (
                <span className="text-red-500 ml-2">
                  (Error loading supplied balance)
                </span>
              )}
            </div>
            {/* Set Goal Card (modal style) with fluid animation */}
            {showGoalCard && (
              <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/30 backdrop-blur-sm animate-fade-in-fast">
                <div className="glass-card rounded-2xl p-6 shadow-2xl w-80 flex flex-col items-center transform transition-all duration-300 scale-95 opacity-0 animate-modal-in">
                  <h3 className="text-lg font-semibold mb-4 text-primary">Set Supply Goal</h3>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={supplyGoal}
                    onChange={e => setSupplyGoal(Number(e.target.value))}
                    className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all duration-200 text-lg mb-4 bg-transparent text-primary"
                    style={{ borderColor: 'var(--input-border)' }}
                  />
                  <button
                    className="submit-button w-full py-2 rounded-xl text-lg font-medium transition-all duration-200"
                    onClick={() => setShowGoalCard(false)}
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Card */}
        <div className="glass-card rounded-2xl p-8 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Amount Input */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Amount
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="input-focus w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-lg"
                  placeholder="0.00"
                  step="0.000001"
                  min="0"
                  disabled={isLoading}
                />
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-secondary">
                  {selectedToken.symbol}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setAction('deposit')}
                className={`action-button hover-lift p-4 rounded-xl text-lg font-medium transition-all duration-200 ${
                  action === 'deposit' ? 'active' : ''
                }`}
                disabled={isLoading}
              >
                Deposit
              </button>
              <button
                type="button"
                onClick={() => setAction('withdraw')}
                className={`action-button hover-lift p-4 rounded-xl text-lg font-medium transition-all duration-200 ${
                  action === 'withdraw' ? 'active' : ''
                }`}
                disabled={isLoading}
              >
                Withdraw
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!amount || !address || isLoading}
              className={`submit-button hover-lift w-full py-4 rounded-xl text-lg font-medium transition-all duration-200 ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </div>
              ) : (
                `${action === 'deposit' ? 'Deposit' : 'Withdraw'} ${selectedToken.symbol}`
              )}
            </button>

            {/* Transaction Status */}
            {txStatus === 'pending' && (
              <div className="text-blue-500 text-sm mt-2 animate-fade-in flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Transaction pending...
              </div>
            )}
            {txStatus === 'success' && (
              <div className="text-green-500 text-sm mt-2 animate-fade-in flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                Transaction successful!
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="text-red-500 text-sm mt-2 animate-fade-in flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                {error}
              </div>
            )}

            {/* Transaction Hash */}
            {txHash && (
              <div className="text-green-500 text-sm mt-2 animate-fade-in flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Transaction submitted! Hash: {txHash}
              </div>
            )}
          </form>
        </div>

        {/* Transaction History Toggle */}
        <div className="text-center mb-8">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-secondary hover:text-primary transition-colors duration-200 flex items-center mx-auto"
          >
            <span>{showHistory ? 'Hide' : 'Show'} Transaction History</span>
            <svg
              className={`w-4 h-4 ml-2 transform transition-transform duration-200 ${showHistory ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
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
          onSelect={(key) => setSelectedTokenKey(key)}
          selectedTokenKey={selectedTokenKey}
          tokens={TOKENS}
          theme={theme}
        />
      </div>
    </div>
  );
}

export default App;