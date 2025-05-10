import React from 'react';

interface TimePeriodModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (period: string) => void;
  selectedPeriod: string;
  theme: 'light' | 'dark';
}

const TIME_PERIODS = [
  { value: '1h', label: '1 Hour' },
  { value: '1d', label: '1 Day' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
];

const TimePeriodModal: React.FC<TimePeriodModalProps> = ({
  open,
  onClose,
  onSelect,
  selectedPeriod,
  theme,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in-fast">
      <div className="glass-card rounded-2xl p-6 shadow-2xl w-96 flex flex-col items-center animate-modal-in">
        <h3 className="text-lg font-semibold mb-4 text-primary">Select Time Period</h3>
        <div className="w-full space-y-2 mb-4">
          {TIME_PERIODS.map((period) => {
            const isSelected = period.value === selectedPeriod;
            const selectedClass = isSelected
              ? theme === 'dark'
                ? 'bg-blue-500 text-white'
                : 'bg-blue-500 text-white'
              : theme === 'dark'
                ? 'bg-transparent hover:bg-blue-900 text-primary'
                : 'bg-transparent hover:bg-blue-300 text-primary';

            return (
              <button
                key={period.value}
                className={`w-full flex items-center justify-between px-4 py-2 rounded-xl transition-all duration-150 text-lg font-medium ${selectedClass}`}
                onClick={() => {
                  onSelect(period.value);
                  onClose();
                }}
              >
                <span>{period.label}</span>
                {isSelected && (
                  <span className="text-sm">✓</span>
                )}
              </button>
            );
          })}
        </div>
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

export default TimePeriodModal; 