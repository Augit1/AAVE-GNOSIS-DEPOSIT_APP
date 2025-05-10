import { useState, useEffect } from 'react';
import { useReadContract } from 'wagmi';
import { ERC20_ABI } from '../../config/abis';
import { TOKENS } from '../../config/constants';
import { formatUnits } from 'viem';

interface TokenSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectToken: (token: typeof TOKENS[keyof typeof TOKENS]) => void;
  userAddress: `0x${string}` | undefined;
}

export function TokenSelectionModal({ isOpen, onClose, onSelectToken, userAddress }: TokenSelectionModalProps) {
  const [selectedToken, setSelectedToken] = useState<keyof typeof TOKENS | null>(null);

  // Read balances for all tokens
  const tokenBalances = Object.entries(TOKENS).map(([symbol, token]) => {
    const { data: balance, isLoading } = useReadContract({
      address: token.address,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: userAddress ? [userAddress] : undefined,
      query: {
        enabled: !!userAddress,
        refetchInterval: 5000,
      },
    });

    return {
      symbol,
      token,
      balance: balance ? formatUnits(balance, token.decimals) : '0',
      isLoading,
    };
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Select Token to Supply</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {tokenBalances.map(({ symbol, token, balance, isLoading }) => (
            <button
              key={symbol}
              onClick={() => {
                setSelectedToken(symbol as keyof typeof TOKENS);
                onSelectToken(token);
                onClose();
              }}
              className="w-full p-4 flex items-center justify-between rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                  {symbol.charAt(0)}
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-900 dark:text-white">{symbol}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{token.symbol}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium text-gray-900 dark:text-white">
                  {isLoading ? '...' : parseFloat(balance).toFixed(4)}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Balance</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
} 