import React from 'react';

interface Token {
  address: string;
  decimals: number;
  symbol: string;
  aTokenAddress: string;
}

interface TokenSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (tokenKey: string, token: Token) => void;
  selectedTokenKey: string;
  tokens: Record<string, Token>;
  theme: 'light' | 'dark';
}

const TokenSelectionModal: React.FC<TokenSelectionModalProps> = ({ open, onClose, onSelect, selectedTokenKey, tokens, theme }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in-fast">
      <div className="glass-card rounded-2xl p-6 shadow-2xl w-80 flex flex-col items-center animate-modal-in">
        <h3 className="text-lg font-semibold mb-4 text-primary">Select a Token</h3>
        <div className="w-full space-y-2 mb-4">
          {Object.entries(tokens).map(([key, token]) => {
            const isSelected = key === selectedTokenKey;
            const selectedClass = isSelected
              ? theme === 'dark'
                ? 'bg-blue-500 text-white'
                : 'bg-blue-500 text-white'
              : theme === 'dark'
                ? 'bg-transparent hover:bg-blue-900 text-primary'
                : 'bg-transparent hover:bg-blue-300 text-primary';
            return (
              <button
                key={key}
                className={`w-full flex items-center justify-between px-4 py-2 rounded-xl transition-all duration-150 text-lg font-medium ${selectedClass}`}
                onClick={() => { onSelect(key, token); onClose(); }}
              >
                <span>{token.symbol}</span>
                <span className="text-xs text-secondary">{token.address.slice(0, 6)}...{token.address.slice(-4)}</span>
              </button>
            );
          })}
        </div>
        <button
          className="submit-button w-full py-2 rounded-xl text-lg font-medium transition-all duration-200 mt-2"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default TokenSelectionModal; 