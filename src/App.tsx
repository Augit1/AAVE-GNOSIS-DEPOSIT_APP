import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseUnits, formatUnits, Hash } from 'viem';
import { AAVE_POOL_ABI, ERC20_ABI } from './config/abis';
import { AAVE_POOL_ADDRESS, TOKENS } from './config/constants';
import { FaWallet } from 'react-icons/fa';
import { GiPlantSeed } from 'react-icons/gi';
import { TokenSelectionModal } from './app/components/TokenSelectionModal';
import { SafeStatusCard, BorrowFundsCard } from './app/components/SafeIntegration';
import { SafeAnalytics, SafeTransaction } from './app/components/SafeAnalytics';
import { motion } from 'framer-motion';

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
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState(TOKENS.USDC);

  // Analytics state
  const [userAccountData, setUserAccountData] = useState<any>(null);
  const [userReserveData, setUserReserveData] = useState<any>(null);
  const [collateralBalance, setCollateralBalance] = useState<bigint | undefined>(undefined);
  const [healthFactor, setHealthFactor] = useState(0);
  const [safeTxs, setSafeTxs] = useState<any[]>([]);
  const [safeTxsLoading, setSafeTxsLoading] = useState(false);
  const [safeTxsError, setSafeTxsError] = useState<string | null>(null);
  const [safeTransactions, setSafeTransactions] = useState<SafeTransaction[]>([]);

  // Convert regular transactions to safe transactions when needed
  useEffect(() => {
    const convertedTransactions: SafeTransaction[] = transactions.map(tx => ({
      hash: tx.hash,
      type: tx.type === 'deposit' ? 'borrow' : 'repay' as const,
      amount: tx.amount,
      timestamp: tx.timestamp,
      status: tx.status === 'success' ? 'success' : tx.status === 'pending' ? 'pending' : 'failed' as const
    }));
    setSafeTransactions(convertedTransactions);
  }, [transactions]);

  // Read user's token balance
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
      enabled: !!address,
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
  const { data: aTokenBalance, isLoading: isATokenLoading, isError: isATokenError } = useReadContract({
    address: selectedToken.aTokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000,
    },
  });

  // Monitor transaction status
  const { isLoading: isConfirming, isSuccess, isError } = useWaitForTransactionReceipt({
    hash: txHash || undefined,
  });

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
  const walletBalance = balance ? parseFloat(formatBalance(balance)) : 0;
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
    <div className="min-h-screen p-4 md:p-8">
      <div className="animated-background" />
      <div className="floating-elements">
        <div className="floating-element" />
        <div className="floating-element" />
        <div className="floating-element" />
      </div>

      <motion.button
        onClick={toggleTheme}
        className="theme-toggle fixed top-4 right-4 p-2 rounded-full bg-card-bg border border-card-border hover:bg-card-hover transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Toggle theme"
      >
        {theme === 'light' ? (
          <svg
            className="w-5 h-5 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ) : (
          <svg
            className="w-5 h-5 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </motion.button>

      <div className="max-w-4xl mx-auto space-y-8 pb-28">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-bold text-primary">Aave Integration</h1>
          <ConnectButton />
        </div>

        {address ? (
          <div className="space-y-8">
            {/* Deposit/Withdraw Card - Full Width */}
            <div className="glass-card p-6 rounded-xl backdrop-blur-lg border border-card-border shadow-lg hover-lift">
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
                    className={`action-button hover-lift p-4 rounded-xl text-lg font-medium transition-all duration-200 active:scale-95 transition-transform ${
                      action === 'deposit' ? 'active' : ''
                    }`}
                    disabled={isLoading}
                  >
                    Deposit
                  </button>
                  <button
                    type="button"
                    onClick={() => setAction('withdraw')}
                    className={`action-button hover-lift p-4 rounded-xl text-lg font-medium transition-all duration-200 active:scale-95 transition-transform ${
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

            {/* Two Column Layout for Analytics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-8">
                {/* Position Analytics Card */}
                <div className="glass-card hover-lift p-6 rounded-xl backdrop-blur-lg border border-card-border shadow-lg">
                  <SafeAnalytics
                    userAccountData={userAccountData}
                    userReserveData={userReserveData}
                    collateralBalance={collateralBalance}
                    transactions={safeTransactions}
                    theme={theme}
                    healthFactor={healthFactor}
                    safeTxs={safeTxs}
                    safeTxsLoading={safeTxsLoading}
                    safeTxsError={safeTxsError}
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-8">
                {/* Safe Status Card */}
                <div className="glass-card hover-lift p-6 rounded-xl backdrop-blur-lg border border-card-border shadow-lg">
                  <SafeStatusCard theme={theme} />
                </div>
                {/* Borrow Funds Card */}
                <div className="glass-card hover-lift p-6 rounded-xl backdrop-blur-lg border border-card-border shadow-lg">
                  <BorrowFundsCard theme={theme} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-card p-8 rounded-xl backdrop-blur-lg border border-card-border shadow-lg text-center">
            <h2 className="text-2xl font-semibold mb-4 text-primary">Welcome to Aave Integration</h2>
            <p className="text-secondary mb-6">Connect your wallet to get started</p>
            <ConnectButton />
          </div>
        )}

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
                  className="flex items-center justify-between p-4 rounded-xl bg-opacity-50 bg-gray-100 dark:bg-gray-800"
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
        <div className="fixed bottom-0 left-0 right-0 py-3 bg-opacity-80 backdrop-blur-sm bg-gradient-to-t from-gray-900/10 to-transparent dark:from-gray-900/20">
          <div className="max-w-2xl mx-auto px-4">
            <div className="text-center text-sm text-secondary space-y-1">
              <p className="animate-fade-in">Connected to Gnosis Chain</p>
              <p className="animate-fade-in-delayed">Powered by Aave Protocol</p>
            </div>
          </div>
        </div>

        {/* Add the token selection modal */}
        <TokenSelectionModal
          isOpen={isTokenModalOpen}
          onClose={() => setIsTokenModalOpen(false)}
          onSelectToken={setSelectedToken}
          userAddress={address}
        />
      </div>
    </div>
  );
}

export default App;