import { useState, useCallback } from 'react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { parseUnits, encodeFunctionData } from 'viem';
import {
  SAFE_FACTORY_ADDRESS,
  SAFE_PROXY_FACTORY_ADDRESS,
  SAFE_MASTER_COPY_ADDRESS,
  SAFE_FACTORY_ABI,
  SAFE_PROXY_FACTORY_ABI,
  SAFE_MASTER_COPY_ABI
} from '../../config/safe';

export function useSafe() {
  const [isCreating, setIsCreating] = useState(false);
  const [safeAddress, setSafeAddress] = useState<string | null>(null);
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const createSafe = useCallback(async () => {
    if (!address) return;

    setIsCreating(true);
    try {
      // Encode the setup function call
      const setupData = encodeFunctionData({
        abi: SAFE_MASTER_COPY_ABI,
        functionName: 'setup',
        args: [
          [address], // owners
          1n, // threshold
          '0x0000000000000000000000000000000000000000', // to
          '0x', // data
          '0x0000000000000000000000000000000000000000', // fallbackHandler
          '0x0000000000000000000000000000000000000000', // paymentToken
          0n, // payment
          '0x0000000000000000000000000000000000000000' // paymentReceiver
        ]
      });

      // Create the Safe proxy
      const tx = await writeContractAsync({
        address: SAFE_PROXY_FACTORY_ADDRESS,
        abi: SAFE_PROXY_FACTORY_ABI,
        functionName: 'createProxyWithNonce',
        args: [
          SAFE_MASTER_COPY_ADDRESS,
          setupData,
          0n // saltNonce
        ]
      });

      // Wait for transaction and get the Safe address
      // Note: In a real implementation, you would need to decode the event logs
      // to get the actual Safe address. This is a simplified version.
      setSafeAddress('0x...'); // Placeholder for actual Safe address

    } catch (error) {
      console.error('Error creating Safe:', error);
      throw error;
    } finally {
      setIsCreating(false);
    }
  }, [address, writeContractAsync]);

  const executeTransaction = useCallback(async (
    to: string,
    value: bigint,
    data: string,
    operation: number = 0
  ) => {
    if (!safeAddress) throw new Error('Safe not created');

    try {
      const tx = await writeContractAsync({
        address: safeAddress as `0x${string}`,
        abi: SAFE_MASTER_COPY_ABI,
        functionName: 'execTransaction',
        args: [
          to,
          value,
          data,
          operation,
          0n, // safeTxGas
          0n, // baseGas
          0n, // gasPrice
          '0x0000000000000000000000000000000000000000', // gasToken
          '0x0000000000000000000000000000000000000000', // refundReceiver
          '0x' // signatures
        ]
      });

      return tx;
    } catch (error) {
      console.error('Error executing Safe transaction:', error);
      throw error;
    }
  }, [safeAddress, writeContractAsync]);

  return {
    isCreating,
    safeAddress,
    createSafe,
    executeTransaction
  };
} 