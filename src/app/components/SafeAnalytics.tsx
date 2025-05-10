import { useState, useEffect } from 'react';
import { formatUnits } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { FaChartLine, FaHistory, FaChevronDown, FaInfoCircle } from 'react-icons/fa';
import { GiPlantSeed } from 'react-icons/gi';

export interface SafeTransaction {
  hash: string;
  type: 'borrow' | 'repay' | 'transfer';
  amount: string;
  timestamp: number;
  status: 'success' | 'pending' | 'failed';
}

interface SafeAnalyticsProps {
  userAccountData: any;
  userReserveData?: any;
  collateralBalance: bigint | undefined;
  transactions: SafeTransaction[];
  theme: 'light' | 'dark';
  healthFactor: number;
  safeTxs?: any[];
  safeTxsLoading?: boolean;
  safeTxsError?: string | null;
}

// Helper for formatting numbers
function formatNumber(val: string | number, decimals = 2) {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0.00';
  return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

export function SafeAnalytics({ userAccountData, userReserveData, collateralBalance, transactions, theme, healthFactor, safeTxs, safeTxsLoading, safeTxsError }: SafeAnalyticsProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'24h' | '7d' | '30d'>('24h');

  const getHealthFactorColor = (factor: number) => {
    if (factor >= 1.5) return 'from-green-400 to-emerald-500';
    if (factor >= 1.1) return 'from-yellow-400 to-orange-500';
    return 'from-red-400 to-rose-500';
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div>
      {/* Analytics Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <FaChartLine className="text-xl text-blue-500" />
          <h3 className="text-lg font-medium text-primary">Position Analytics</h3>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="p-2 rounded-full hover:bg-card-bg transition-colors"
        >
          <FaChevronDown className={`transform transition-transform ${showDetails ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Health Factor Gauge + Warning */}
      <div className="relative mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-secondary flex items-center gap-1">
            Health Factor
            <span className="tooltip-container ml-1">
              <FaInfoCircle className="w-4 h-4 text-blue-400 inline-block align-middle" />
              <span className="tooltip-content absolute left-1/2 z-10 min-w-max px-2 py-1 rounded bg-black text-white text-xs opacity-0 invisible transition-all duration-200" style={{top: '120%'}}>
                A higher health factor means your position is safer from liquidation. If it drops below 1, you may be liquidated. If you see ∞, you have no debt and are completely safe.
                <span className="tooltip-arrow" />
              </span>
            </span>
          </span>
          <span className="text-sm font-semibold text-primary flex items-center gap-2">
            {userAccountData ? (
              Number(formatUnits(userAccountData[5], 18)) > 100
                ? <span title="No debt, completely safe">∞</span>
                : formatNumber(Number(formatUnits(userAccountData[5], 18)))
            ) : '0.00'}
            {healthFactor < 1.1 && (
              <span className="ml-2 px-2 py-0.5 rounded bg-red-500 text-white text-xs animate-pulse">Low!</span>
            )}
          </span>
        </div>
        <div className={`${theme === 'dark' ? 'h-2 bg-gray-700' : 'h-2 bg-gray-200'} rounded-full overflow-hidden`}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ 
              width: `${Math.min(Number(formatUnits(userAccountData?.[5] || 0n, 18)) * 100, 100)}%` 
            }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={`progress-bar h-full ${theme === 'dark' ? getHealthFactorColor(Number(formatUnits(userAccountData?.[5] || 0n, 18))) : getHealthFactorColor(Number(formatUnits(userAccountData?.[5] || 0n, 18)))}`}
            style={{ background: theme === 'dark'
              ? `linear-gradient(to right, ${getHealthFactorColor(Number(formatUnits(userAccountData?.[5] || 0n, 18))).replace('from-', '').replace('to-', '').replace(/ /g, ', ')})`
              : `linear-gradient(to right, ${getHealthFactorColor(Number(formatUnits(userAccountData?.[5] || 0n, 18))).replace('from-', '').replace('to-', '').replace(/ /g, ', ')})` }}
          />
        </div>
      </div>

      {/* Quick Stats (per-asset) */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}> 
          <div className="flex flex-col gap-1">
            <span className="text-xs text-secondary">Supplied (USDC)</span>
            <span className="text-xl font-semibold text-primary">
              {userReserveData ? formatNumber(formatUnits(userReserveData[0], 6)) : '0.00'} <span className="text-xs font-normal">USDC</span>
            </span>
          </div>
        </div>
        <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}> 
          <div className="flex flex-col gap-1">
            <span className="text-xs text-secondary">Borrowed (USDC)</span>
            <span className="text-xl font-semibold text-primary">
              {userReserveData ? formatNumber(formatUnits(userReserveData[2], 6)) : '0.00'} <span className="text-xs font-normal">USDC</span>
            </span>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}> 
          <div className="flex flex-col gap-1">
            <span className="text-xs text-secondary">Collateral</span>
            <span className="text-xl font-semibold text-primary">
              {collateralBalance ? formatNumber(formatUnits(collateralBalance, 6)) : '0.00'} <span className="text-xs font-normal">USDC</span>
            </span>
          </div>
        </div>
        <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}> 
          <div className="flex flex-col gap-1">
            <span className="text-xs text-secondary">Borrowed</span>
            <span className="text-xl font-semibold text-primary">
              {userAccountData ? formatNumber(formatUnits(userAccountData[1], 8)) : '0.00'} <span className="text-xs font-normal">USDC</span>
            </span>
          </div>
        </div>
      </div>

      {/* Detailed Analytics */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 pt-4 border-t border-card-border">
              {/* Timeframe Selector */}
              <div className="flex gap-2">
                {(['24h', '7d', '30d'] as const).map((timeframe) => (
                  <button
                    key={timeframe}
                    onClick={() => setSelectedTimeframe(timeframe)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors font-medium
                      ${selectedTimeframe === timeframe
                        ? 'bg-blue-500 text-white'
                        : theme === 'dark'
                          ? 'bg-gray-800 text-secondary hover:bg-gray-700 hover:text-primary'
                          : 'bg-gray-50 text-secondary hover:bg-gray-200 hover:text-primary'}
                    `}
                  >
                    {timeframe}
                  </button>
                ))}
              </div>

              {/* Transaction History */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-secondary mb-2">
                  <FaHistory className="text-sm" />
                  <span className="text-sm">Recent Activity</span>
                </div>
                {safeTxsLoading && <div className="text-xs text-secondary">Loading Safe transactions...</div>}
                {safeTxsError && <div className="text-xs text-red-500">{safeTxsError}</div>}
                {safeTxs && safeTxs.length > 0 ? (
                  safeTxs.map((tx) => (
                    <motion.div
                      key={tx.safeTxHash}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          tx.isExecuted ? 'bg-green-500' : 'bg-blue-500'
                        }`} />
                        <div>
                          <div className="text-sm font-medium text-primary">
                            {tx.value && parseInt(tx.value) > 0 ? `${formatNumber(parseInt(tx.value) / 1e18, 4)} ETH` : 'Contract Call'}
                          </div>
                          <div className="text-xs text-secondary">{tx.executionDate ? new Date(tx.executionDate).toLocaleString() : 'Pending'}</div>
                        </div>
                      </div>
                      <a
                        href={`https://gnosisscan.io/tx/${tx.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-600 text-sm"
                      >
                        View
                      </a>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-xs text-secondary">No Safe transactions found.</div>
                )}
              </div>

              {/* Additional Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-secondary">Available to Borrow</span>
                    <span className="text-lg font-semibold text-primary">
                      {userAccountData ? formatNumber(formatUnits(userAccountData[2], 8)) : '0.00'} <span className="text-xs font-normal">USDC</span>
                    </span>
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-secondary">Liquidation Threshold</span>
                    <span className="text-lg font-semibold text-primary">
                      {userAccountData ? formatNumber(Number(formatUnits(userAccountData[3], 4))) : '0.00'}<span className="text-xs font-normal">%</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 