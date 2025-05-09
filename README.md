# Aave Deposit App

A React application for depositing and withdrawing tokens on Aave Protocol (Gnosis Chain).

## Features

- Connect wallet using RainbowKit
- Deposit tokens to Aave Protocol
- Withdraw tokens from Aave Protocol
- Modern, Apple-like UI design

## Prerequisites

- Node.js 18 or later
- npm or yarn
- A WalletConnect project ID (get one at https://cloud.walletconnect.com)

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/yourusername/aave-gnosis-deposit-app.git
cd aave-gnosis-deposit-app
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
VITE_APP_NAME=Aave Deposit App
VITE_WALLET_CONNECT_PROJECT_ID=your_wallet_connect_project_id
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:5173](http://localhost:5173) in your browser.

## Building for Production

```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## Technologies Used

- React
- TypeScript
- Vite
- wagmi v2
- RainbowKit
- TailwindCSS
- Aave Protocol
- Gnosis Chain

## License

ISC
