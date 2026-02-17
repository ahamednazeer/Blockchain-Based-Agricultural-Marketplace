# Setup Guide (Step by Step)

This guide is a focused setup playbook for running the project locally with Ganache.

Project root:
`/Users/syed.ahamed/skillup/Blockchain-Based-Agricultural-Marketplace`

## 1) Prerequisites

- Node.js 18+
- Ganache (GUI or CLI)
- MetaMask extension
- MongoDB (local or Atlas)

## 2) Start Ganache

Start Ganache and keep it running.

Expected local network:
- RPC: `http://127.0.0.1:7545`
- Chain ID: `1337`

Quick check:

```bash
curl -s -X POST http://127.0.0.1:7545 \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
```

Expected result includes: `"0x539"` (hex for 1337).

## 3) Deploy smart contract

```bash
cd /Users/syed.ahamed/skillup/Blockchain-Based-Agricultural-Marketplace/contracts
npm install
npm run deploy:ganache
```

Deployment output is written to:
- `contracts/deployments/ganache.json`

## 4) Configure backend

Create or update:
- `/Users/syed.ahamed/skillup/Blockchain-Based-Agricultural-Marketplace/backend/.env`

Minimum required keys:

```env
PORT=8000
MONGODB_URI=<your_mongodb_uri>
JWT_SECRET=<your_secret>

ADMIN_USERNAME=admin
ADMIN_PASSWORD=test123

GANACHE_RPC_URL=http://127.0.0.1:7545
CONTRACT_ADDRESS=<from contracts/deployments/ganache.json>
CONTRACT_ABI_PATH=../contracts/deployments/ganache.json

ADMIN_WALLET=<ganache_deployer_wallet>
ADMIN_PRIVATE_KEY=<private_key_of_same_deployer_wallet>

CORS_ORIGIN=http://localhost:3000
```

Important:
- `ADMIN_PRIVATE_KEY` must match the contract owner wallet.
- If Ganache is reset and contract is redeployed, update `CONTRACT_ADDRESS`.

## 5) Start backend

```bash
cd /Users/syed.ahamed/skillup/Blockchain-Based-Agricultural-Marketplace/backend
npm install
npm run dev
```

Health check:

```bash
curl -s http://127.0.0.1:8000/health
```

Expected: `{"status":"ok"}`

## 6) Configure frontend

Create:
- `/Users/syed.ahamed/skillup/Blockchain-Based-Agricultural-Marketplace/frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 7) Start frontend

```bash
cd /Users/syed.ahamed/skillup/Blockchain-Based-Agricultural-Marketplace/frontend
npm install
npm run dev
```

Open:
- `http://localhost:3000`

## 8) MetaMask setup

Add network:
- Network name: `Ganache`
- RPC URL: `http://127.0.0.1:7545`
- Chain ID: `1337`
- Currency symbol: `ETH`

Then import funded Ganache accounts and use them as:
- Admin wallet
- Farmer wallet
- Buyer wallet

## 9) Normal app flow

1. Register Farmer and Buyer.
2. Login as Admin and approve users.
3. Farmer creates listing.
4. Admin approves listing (publishes on-chain).
5. Buyer purchases from marketplace.

## 10) Top up wallet ETH (local Ganache)

If MetaMask shows insufficient funds:

```bash
cd /Users/syed.ahamed/skillup/Blockchain-Based-Agricultural-Marketplace/backend
npm run send:eth -- --to <WALLET_ADDRESS> --eth 10
```

Optional flags:
- `--rpc http://127.0.0.1:7545`
- `--from <FUNDED_GANACHE_ADDRESS>`
- `--pk <PRIVATE_KEY>`

## 11) Fix checkout error: missing revert data (estimateGas)

If checkout fails with `missing revert data` for `purchaseBatch` or `purchaseCrop`:

1. Ensure buyer wallet has ETH.
2. Clear marketplace cart and hard refresh.
3. Re-approve listing in Admin Listings (republish on-chain IDs if stale).
4. If admin approve fails on-chain, fix owner mismatch:
   - Redeploy contract (`npm run deploy:ganache`)
   - Update backend `CONTRACT_ADDRESS`
   - Ensure `ADMIN_PRIVATE_KEY` matches contract owner
   - Restart backend

## 12) Reset-safe checklist (when Ganache restarts)

1. Confirm Ganache RPC and chain ID.
2. Redeploy contract.
3. Update backend `.env` contract address.
4. Restart backend.
5. Re-approve listings to republish on-chain IDs.
6. Re-check buyer wallet ETH.
