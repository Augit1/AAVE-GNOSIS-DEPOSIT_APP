'use client';

import { useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseUnits } from 'viem';
import { AAVE_POOL_ABI, ERC20_ABI } from '@/config/abis';
import { AAVE_POOL_ADDRESS, TOKENS } from '@/config/constants';

export default function Home() {
  const [amount, setAmount] = useState('');
  const [action, setAction] = useState<'deposit' | 'withdraw'>('deposit');
  const { address } = useAccount();
  const { writeContract: writeContract } = useWriteContract();

  const selectedToken = TOKENS.USDC;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !address) return;

    const amountInWei = parseUnits(amount, selectedToken.decimals);

    if (action === 'deposit') {
      // First approve the Aave Pool to spend tokens
      await writeContract({
        address: selectedToken.address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [AAVE_POOL_ADDRESS, amountInWei],
      });

      // Then deposit
      await writeContract({
        address: AAVE_POOL_ADDRESS,
        abi: AAVE_POOL_ABI,
        functionName: 'supply',
        args: [selectedToken.address, amountInWei, address, 0],
      });
    } else {
      // Withdraw
      await writeContract({
        address: AAVE_POOL_ADDRESS,
        abi: AAVE_POOL_ABI,
        functionName: 'withdraw',
        args: [selectedToken.address, amountInWei, address],
      });
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold mb-8">Aave Deposit App</h1>
        
        <div className="mb-8">
          <ConnectButton />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="Enter amount"
              step="0.000001"
              min="0"
            />
          </div>

          <div className="flex space-x-4">
            <button
              type="button"
              onClick={() => setAction('deposit')}
              className={`flex-1 p-2 rounded ${
                action === 'deposit'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200'
              }`}
            >
              Deposit
            </button>
            <button
              type="button"
              onClick={() => setAction('withdraw')}
              className={`flex-1 p-2 rounded ${
                action === 'withdraw'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200'
              }`}
            >
              Withdraw
            </button>
          </div>

          <button
            type="submit"
            className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            disabled={!amount || !address}
          >
            {action === 'deposit' ? 'Deposit' : 'Withdraw'} {selectedToken.symbol}
          </button>
        </form>
      </div>
    </main>
  );
}
