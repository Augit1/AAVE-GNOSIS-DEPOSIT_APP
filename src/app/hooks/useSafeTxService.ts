import { useState, useEffect } from 'react';

export function useSafeTxService(safeAddress?: string) {
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!safeAddress) return;
    let active = true;
    const fetchTxs = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`https://safe-transaction-gnosis-chain.safe.global/api/v1/safes/${safeAddress}/multisig-transactions/?limit=10&executed=true`);
        if (!res.ok) throw new Error('Failed to fetch Safe transactions');
        const data = await res.json();
        if (active) setTxs(data.results || []);
      } catch (e: any) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchTxs();
    const interval = setInterval(fetchTxs, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [safeAddress]);

  return { txs, loading, error };
} 