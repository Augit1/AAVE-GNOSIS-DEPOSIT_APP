import { Address } from 'viem';

export const SAFE_FACTORY_ADDRESS = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67' as Address;
export const SAFE_PROXY_FACTORY_ADDRESS = '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2' as Address;
export const SAFE_MASTER_COPY_ADDRESS = '0x3E5c63644E683549055b9Be8653de26E0B4CD36E' as Address;

export const SAFE_FACTORY_ABI = [
  {
    inputs: [
      { name: 'owners', type: 'address[]' },
      { name: 'threshold', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'data', type: 'bytes' },
      { name: 'fallbackHandler', type: 'address' },
      { name: 'paymentToken', type: 'address' },
      { name: 'payment', type: 'uint256' },
      { name: 'paymentReceiver', type: 'address' }
    ],
    name: 'createProxyWithNonce',
    outputs: [{ name: 'proxy', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;

export const SAFE_PROXY_FACTORY_ABI = [
  {
    inputs: [
      { name: '_mastercopy', type: 'address' },
      { name: 'initializer', type: 'bytes' },
      { name: 'saltNonce', type: 'uint256' }
    ],
    name: 'createProxyWithNonce',
    outputs: [{ name: 'proxy', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;

export const SAFE_MASTER_COPY_ABI = [
  {
    inputs: [
      { name: 'owners', type: 'address[]' },
      { name: 'threshold', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'data', type: 'bytes' },
      { name: 'fallbackHandler', type: 'address' },
      { name: 'paymentToken', type: 'address' },
      { name: 'payment', type: 'uint256' },
      { name: 'paymentReceiver', type: 'address' }
    ],
    name: 'setup',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'safeTxGas', type: 'uint256' },
      { name: 'baseGas', type: 'uint256' },
      { name: 'gasPrice', type: 'uint256' },
      { name: 'gasToken', type: 'address' },
      { name: 'refundReceiver', type: 'address' },
      { name: 'signatures', type: 'bytes' }
    ],
    name: 'execTransaction',
    outputs: [{ name: 'success', type: 'bool' }],
    stateMutability: 'payable',
    type: 'function'
  }
] as const; 