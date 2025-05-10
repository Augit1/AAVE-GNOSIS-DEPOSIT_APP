import { useState, useEffect } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseUnits, encodeFunctionData } from 'viem';
import { AAVE_POOL_ABI } from '../../config/abis';
import { AAVE_POOL_ADDRESS, TOKENS } from '../../config/constants';
import { MdAccountBalanceWallet } from 'react-icons/md';
import { useSafe } from '../hooks/useSafe';
import { motion } from 'framer-motion';

interface SafeTransaction {
  hash: string;
  type: 'borrow' | 'repay' | 'transfer';
  amount: string;
  timestamp: number;
  status: 'success' | 'pending' | 'failed';
}

interface SafeIntegrationProps {
  theme: 'light' | 'dark';
}

export function SafeStatusCard({ theme }: { theme: 'light' | 'dark' }) {
  const { isCreating, safeAddress, createSafe } = useSafe();
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MdAccountBalanceWallet className="text-xl text-blue-500" />
          <span className="text-primary">Safe Status</span>
        </div>
        {safeAddress ? (
          <span className="text-sm text-secondary">{safeAddress}</span>
        ) : (
          <button
            onClick={createSafe}
            disabled={isCreating}
            className="action-button px-4 py-2 rounded-lg bg-button-bg text-button-text hover:bg-button-hover disabled:bg-button-disabled disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating...' : 'Create Safe'}
          </button>
        )}
      </div>
    </div>
  );
}

export function BorrowFundsCard({ theme }: { theme: 'light' | 'dark' }) {
  const [borrowAmount, setBorrowAmount] = useState('');
  const [isBorrowing, setIsBorrowing] = useState(false);
  const [transactions, setTransactions] = useState<SafeTransaction[]>(() => {
    const saved = localStorage.getItem('safeTransactions');
    return saved ? JSON.parse(saved) : [];
  });
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { safeAddress, executeTransaction } = useSafe();

  useEffect(() => {
    localStorage.setItem('safeTransactions', JSON.stringify(transactions));
  }, [transactions]);

  const handleBorrow = async () => {
    if (!borrowAmount || !address || !safeAddress) return;
    setIsBorrowing(true);
    try {
      const borrowData = encodeFunctionData({
        abi: AAVE_POOL_ABI,
        functionName: 'borrow',
        args: [
          TOKENS.USDC.address,
          parseUnits(borrowAmount, 6),
          2,
          0,
          address,
        ],
      });
      const pendingTx: SafeTransaction = {
        hash: 'pending',
        type: 'borrow',
        amount: borrowAmount,
        timestamp: Date.now(),
        status: 'pending',
      };
      setTransactions(prev => [pendingTx, ...prev]);
      const tx = await executeTransaction(
        AAVE_POOL_ADDRESS,
        0n,
        borrowData
      );
      setTransactions(prev => prev.map(t =>
        t.hash === 'pending'
          ? { ...t, hash: tx, status: 'success' }
          : t
      ));
      setBorrowAmount('');
    } catch (error) {
      console.error('Error borrowing:', error);
      setTransactions(prev => prev.map(t =>
        t.hash === 'pending'
          ? { ...t, status: 'failed' }
          : t
      ));
    } finally {
      setIsBorrowing(false);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-medium mb-4 text-primary">Borrow Funds</h3>
      <div className="space-y-4">
        <div>
          <input
            type="number"
            value={borrowAmount}
            onChange={(e) => setBorrowAmount(e.target.value)}
            className="input-focus w-full px-4 py-2 rounded-lg bg-transparent border border-input-border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            placeholder="Amount to borrow"
          />
        </div>
        <button
          onClick={handleBorrow}
          disabled={!borrowAmount || !safeAddress || isBorrowing}
          className="submit-button w-full py-2 rounded-lg bg-button-bg text-button-text hover:bg-button-hover disabled:bg-button-disabled disabled:cursor-not-allowed hover-lift active:scale-95 transition-transform"
        >
          {isBorrowing ? 'Processing...' : 'Borrow & Transfer to Safe'}
        </button>
      </div>
    </div>
  );
} 