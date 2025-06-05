import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface Token {
  address: `0x${string}`;
  decimals: number;
  symbol: string;
  aTokenAddress: `0x${string}`;
}

interface TokenSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (token: Token) => void;
  selectedTokenAddress: `0x${string}`;
  theme: 'light' | 'dark';
  onTotalValueUpdate: (totalValue: number) => void;
}

interface WalletToken {
  contractAddress: string;
  symbol: string;
  decimals: number;
  balance: string;
  formattedBalance: string;
}

const GNOSIS_BLOCKSCOUT_API = 'https://gnosis.blockscout.com/api';

const TokenSelectionModal: React.FC<TokenSelectionModalProps> = ({ open, onClose, onSelect, selectedTokenAddress, theme, onTotalValueUpdate }) => {
  const [walletTokens, setWalletTokens] = useState<WalletToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { address } = useAccount();

  useEffect(() => {
    const fetchTokenBalances = async () => {
      if (!address || !open) return;
      
      setIsLoading(true);
      try {
        const res = await fetch(
          `${GNOSIS_BLOCKSCOUT_API}?module=account&action=tokenlist&address=${address}`
        );
        const data = await res.json();
        
        if (data?.result && Array.isArray(data.result)) {
          const tokensWithBalance = data.result
            .map((token: any) => {
              const balance = Number(token.balance) / 10 ** Number(token.decimals);
              if (balance > 0) {
                return {
                  contractAddress: token.contractAddress,
                  symbol: token.symbol,
                  decimals: Number(token.decimals),
                  balance: token.balance,
                  formattedBalance: balance.toFixed(6)
                };
              }
              return null;
            })
            .filter((token: WalletToken | null) => token !== null)
            .sort((a: WalletToken, b: WalletToken) => 
              Number(b.formattedBalance) - Number(a.formattedBalance)
            );
          
          setWalletTokens(tokensWithBalance);
          
          // Calculate total value (sum of all token balances)
          const totalValue = tokensWithBalance.reduce((sum: number, token: WalletToken) => 
            sum + Number(token.formattedBalance), 0
          );
          onTotalValueUpdate(totalValue);
        }
      } catch (error) {
        console.error('Error fetching token balances:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTokenBalances();
  }, [address, open, onTotalValueUpdate]);

  const handleTokenSelect = (token: WalletToken) => {
    onSelect({
      address: token.contractAddress as `0x${string}`,
      decimals: token.decimals,
      symbol: token.symbol,
      aTokenAddress: token.contractAddress as `0x${string}` // We'll need to fetch this from Aave API if needed
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in-fast">
      <div className="glass-card rounded-2xl p-6 shadow-2xl w-96 flex flex-col items-center animate-modal-in">
        <h3 className="text-lg font-semibold mb-4 text-primary">Your Wallet Tokens</h3>
        {isLoading ? (
          <div className="flex items-center justify-center w-full py-4">
            <div className="flex space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-100" />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-200" />
            </div>
          </div>
        ) : (
          <div className="w-full space-y-2 mb-4 max-h-[60vh] overflow-y-auto">
            {walletTokens.length === 0 ? (
              <div className="text-center text-secondary py-4">
                No tokens found in your wallet
              </div>
            ) : (
              walletTokens.map((token) => {
                const isSelected = token.contractAddress.toLowerCase() === selectedTokenAddress.toLowerCase();
                const selectedClass = isSelected
                  ? theme === 'dark'
                    ? 'bg-blue-500 text-white'
                    : 'bg-blue-500 text-white'
                  : theme === 'dark'
                    ? 'bg-transparent hover:bg-blue-900 text-primary'
                    : 'bg-transparent hover:bg-blue-300 text-primary';

                return (
                  <button
                    key={token.contractAddress}
                    className={`w-full flex items-center justify-between px-4 py-2 rounded-xl transition-all duration-150 text-lg font-medium ${selectedClass}`}
                    onClick={() => handleTokenSelect(token)}
                  >
                    <span>{token.symbol}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
        <button
          className="submit-button w-full py-2 rounded-xl text-lg font-medium transition-all duration-200 mt-2"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default TokenSelectionModal; 