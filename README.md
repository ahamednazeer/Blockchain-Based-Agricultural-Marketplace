# Blockchain-Based Agricultural Marketplace (Ganache)

A full-stack, role-based agricultural marketplace with admin-governed onboarding, off-chain metadata in MongoDB, and on-chain settlement on a local Ganache network. Farmers list crops, admins approve and publish them on-chain, and buyers purchase in ETH with transparent ledger records.

## Architecture Overview

Layer 1: Frontend (Next.js)
- User dashboards for Admin, Farmer, Buyer
- MetaMask wallet connection for signing and transactions
- Marketplace with cart, partial unit purchases, and checkout flow

Layer 2: Backend (Node.js + Express + MongoDB)
- User registration, admin approvals, and role-based auth
- Crop metadata storage and admin workflows
- Transaction records, ledger events, analytics, expiry monitoring
- File uploads for crop images and compliance certificates

Layer 3: Blockchain (Solidity + Ganache)
- Immutable listing and purchase records
- ETH payments and on-chain events
- Admin pause and blacklist controls

## Roles and Permissions

Admin
- Approves users and crop listings
- Controls contract (pause, blacklist)
- Views all listings, transactions, and reports

Farmer
- Registers and submits crop listings
- Uploads images and compliance certificates
- Updates fulfillment status (shipped, delivered)

Buyer
- Registers and purchases approved crops
- Uses cart and checkout with shipping address
- Tracks order status and delivery timeline

## End-to-End Flow (Short Version)

1. Deploy contract to Ganache.
2. Start backend and frontend.
3. Admin approves farmers and buyers.
4. Farmer creates listing (off-chain).
5. Admin approves listing and publishes on-chain.
6. Buyer purchases via MetaMask (on-chain).
7. Backend syncs events, updates ledger and order status.

## Tech Stack

Frontend
- Next.js 16
- React 19
- Tailwind CSS
- ethers v6

Backend
- Node.js + Express
- MongoDB + Mongoose
- JWT auth
- ethers v6

Blockchain
- Solidity 0.8.24
- Hardhat
- Ganache

## Repository Layout

- `contracts/` Solidity contract, Hardhat config, and deploy script
- `backend/` Express API, MongoDB models, blockchain listener
- `frontend/` Next.js UI
- `frontend-ref/` Design reference only

## Prerequisites

- Node.js 18+ recommended
- Ganache (GUI or CLI)
- MetaMask browser extension
- MongoDB (Atlas or local)

## Quick Start (Local)

1. Start Ganache
- RPC: `http://127.0.0.1:7545`
- Chain ID: `1337`

2. Deploy the contract

```bash
cd /Users/syed.ahamed/skillup/Blockchain-Based-Agricultural-Marketplace/contracts
npm install
npm run deploy:ganache
```

3. Configure backend

Create `/Users/syed.ahamed/skillup/Blockchain-Based-Agricultural-Marketplace/backend/.env`:

```env
PORT=8000
MONGODB_URI=your_mongodb_uri
JWT_SECRET=replace-with-strong-secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=strong-password
ADMIN_WALLET=0xYOUR_ADMIN_ADDRESS
ADMIN_PRIVATE_KEY=0xYOUR_ADMIN_PRIVATE_KEY
GANACHE_RPC_URL=http://127.0.0.1:7545
CONTRACT_ADDRESS=0xYOUR_DEPLOYED_ADDRESS
CONTRACT_ABI_PATH=../contracts/deployments/ganache.json
CORS_ORIGIN=http://localhost:3000
EXPIRY_CHECK_INTERVAL_MS=3600000
ETH_INR_RATE=200000
ETH_RATE_CACHE_MS=60000
TX_RECONCILE_INTERVAL_MS=5000
TX_SYNC_ENABLED=true
TX_SYNC_FROM_BLOCK=0
TX_SYNC_LOOKBACK_BLOCKS=50000
FULFILLMENT_CHECK_INTERVAL_MS=3600000
FULFILLMENT_AUTO_SHIP_HOURS=6
FULFILLMENT_AUTO_DELIVER_HOURS=48
```

4. Start backend

```bash
cd /Users/syed.ahamed/skillup/Blockchain-Based-Agricultural-Marketplace/backend
npm install
npm run dev
```

5. Configure frontend

Create `/Users/syed.ahamed/skillup/Blockchain-Based-Agricultural-Marketplace/frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

6. Start frontend

```bash
cd /Users/syed.ahamed/skillup/Blockchain-Based-Agricultural-Marketplace/frontend
npm install
npm run dev
```

7. MetaMask setup

Network
- Network name: Ganache
- RPC URL: `http://127.0.0.1:7545`
- Chain ID: `1337`
- Currency symbol: `ETH`

Accounts
- Import a funded Ganache account to MetaMask
- Use that account as Buyer for purchases

## Core Features

Marketplace
- Filter by category and unit
- INR and ETH pricing
- Add to cart, single-farmer batch checkout
- Out-of-stock items remain visible but disabled

Unit Scaling
- Supports kg, g, ml, mg, etc
- Stored in base units on-chain
- Allows safe partial purchases

Admin Approvals
- Users must be approved before access
- Listings must be approved before on-chain publish

Orders
- Payment status: PENDING, CONFIRMED, FAILED
- Fulfillment status: PENDING, SHIPPED, DELIVERED
- Shipping address stored with each order

Ledger
- On-chain events stored for listing and purchase history
- Dedicated public ledger view in UI

Uploads
- Crop images and compliance certificates
- Supported: images and PDF
- Size limit: 10 MB

## Smart Contract Summary

Contract: `AgriChain`

Key Functions
- `listCrop(farmer, pricePerUnit, quantity, expiry, offchainId)`
- `purchaseCrop(cropId)`
- `purchaseUnits(cropId, units)`
- `purchaseBatch(cropIds, units)`
- `pause()` / `unpause()`
- `setBlacklist(wallet, status)`

Events
- `CropListed`
- `CropPurchased`
- `ContractPaused`
- `ContractUnpaused`
- `WalletBlacklisted`

Security Rules
- Prevent double sale (`isSold`)
- Prevent underpayment (`msg.value == price`)
- Prevent expired sales (`expiry > block.timestamp`)
- Admin-only operations (`onlyOwner`)
- Reentrancy protection (`nonReentrant`)

## Blockchain Integration (Detailed)

### On-Chain Data Model

Each crop listing is stored on-chain with only the fields required for pricing and settlement. Off-chain metadata is stored in MongoDB.

On-chain `Crop` fields:
- `id`: on-chain crop ID (uint256)
- `farmer`: farmer wallet address
- `pricePerUnit`: price per base unit (wei)
- `quantity`: quantity in base units (uint256)
- `expiry`: UNIX timestamp
- `isSold`: boolean (true when quantity reaches 0)
- `buyer`: last buyer wallet (for reference)
- `offchainId`: MongoDB crop ID string

Off-chain fields live in MongoDB and include:
- Crop name, category, storage type, description
- Images and compliance certificate URLs
- Human-friendly quantity (e.g., `10 kg`) and unit scale

### Unit Scaling (Why Base Units Exist)

To support partial buying, quantities are stored on-chain in the smallest base unit. Examples:
- If unit is `kg`, base unit is `g`, scale = 1000
- If unit is `ml`, base unit is `ml`, scale = 1

The backend converts:
- Display quantity (e.g., `10 kg`) -> base units (`10000 g`)
- Price per display unit -> price per base unit (wei)

This makes `purchaseUnits(cropId, units)` safe for fractional user quantities while keeping integer values on-chain.

### Listing Flow (Off-chain -> On-chain)

1. Farmer submits listing via frontend.
2. Backend saves crop metadata in MongoDB with `status = PENDING`.
3. Admin approves listing.
4. Backend calls `listCrop(...)` on the contract using the admin wallet.
5. Contract emits `CropListed` event.
6. Backend listener updates MongoDB:
   - `contractCropId`
   - `txHash`
   - `status = APPROVED`
   - Backfills ETH pricing from on-chain `pricePerUnit`

### Purchase Flow (On-chain -> Off-chain)

1. Buyer adds items to cart and checks out.
2. Frontend calls `purchaseBatch(cropIds, units)` with `msg.value = totalWei`.
3. Contract validates:
   - Crop exists, not expired, not sold
   - Units requested are available
   - `msg.value` equals expected total
4. Contract emits `CropPurchased`.
5. Backend listener records the transaction in MongoDB:
   - `status = CONFIRMED`
   - `txHash`, `blockNumber`, `timestamp`
   - Buyer wallet, farmer wallet, units, ETH value
6. Backend reduces crop quantity in MongoDB.
7. If quantity reaches zero, crop status becomes `SOLD`.

### Single-Farmer Batch Purchase

`purchaseBatch` requires all crops in the batch to belong to the same farmer. This guarantees:
- Single ETH transfer to the farmer
- One atomic transaction for multiple items

The frontend enforces this by blocking checkout if cart items belong to multiple farmers.

### Event Listener + Reconciliation

The backend runs two systems for blockchain sync:

Event listener:
- Subscribes to `CropListed` and `CropPurchased`
- Updates MongoDB immediately on event receipt

Reconciliation loop:
- Periodically checks all `PENDING` transactions
- Uses `eth_getTransactionReceipt` to confirm or mark `FAILED`

Startup event sync:
- Scans historical blocks and replays events
- Useful if backend was down or Ganache was restarted

Config keys:
- `TX_RECONCILE_INTERVAL_MS`
- `TX_SYNC_ENABLED`
- `TX_SYNC_FROM_BLOCK`
- `TX_SYNC_LOOKBACK_BLOCKS`

### Why Ganache Shows 0.00 ETH

Ganache UI rounds value to two decimals. If a transaction sends less than 0.01 ETH, it will display `0.00` even though it has a real value.

Use `eth_getTransactionByHash` to confirm exact `value` in wei.

### Admin Controls (On-chain)

Admin-only functions:
- `pause()` and `unpause()` stop all purchases
- `setBlacklist(wallet, status)` blocks malicious wallets

These functions are protected by `onlyOwner`, and the owner is the admin wallet used during deployment.

### Price Source of Truth

On-chain price is authoritative for settlement:
- UI displays INR and ETH
- ETH is always used for smart contract payment
- INR is derived from ETH using a live rate

If ETH price is missing in MongoDB, the backend backfills it from on-chain events.

### Event Logs and Decoding (Deep Dive)

The contract emits two critical events:

`CropListed(uint256 cropId, address farmer, uint256 pricePerUnit, uint256 quantity, uint256 expiry, string offchainId)`

`CropPurchased(uint256 cropId, address buyer, uint256 units, uint256 value)`

How the backend decodes:
- The listener receives the event with `event.args` from ethers.
- For reconciliation, the backend parses raw logs using the ABI:
  - `contract.interface.parseLog(log)`
- Decoded fields are mapped into MongoDB:
  - `LedgerEvent` records an immutable audit row
  - `Transaction` is updated to `CONFIRMED`

Example mapping:
- `pricePerUnit` (wei) -> `pricePerBaseUnitEth` (ETH string)
- `value` (wei) -> `valueEth` (ETH string)
- `units` (base units) -> `units` (integer in DB)

Raw receipt inspection (useful for debugging):

```bash
curl -s -X POST http://127.0.0.1:7545 \\
  -H \"Content-Type: application/json\" \\
  --data '{\"jsonrpc\":\"2.0\",\"method\":\"eth_getTransactionReceipt\",\"params\":[\"0xTX_HASH\"],\"id\":1}'
```

Ganache may show `VALUE 0.00` for small transfers because it rounds to 2 decimals. Always trust the receipt value in wei.

### Function-Level Blockchain Flow

#### listCrop (Admin only)

```mermaid
sequenceDiagram
    participant Admin
    participant Backend
    participant Contract
    Admin->>Backend: Approve listing
    Backend->>Contract: listCrop(farmer, pricePerUnit, quantity, expiry, offchainId)
    Contract-->>Backend: CropListed event
    Backend-->>Backend: Store LedgerEvent + update Crop
```

#### purchaseUnits (Buyer)

```mermaid
sequenceDiagram
    participant Buyer
    participant Frontend
    participant Contract
    participant Backend
    Buyer->>Frontend: Select quantity
    Frontend->>Contract: purchaseUnits(cropId, units, msg.value)
    Contract-->>Backend: CropPurchased event
    Backend-->>Backend: Confirm Transaction + reduce quantity
```

#### purchaseBatch (Buyer, same farmer only)

```mermaid
sequenceDiagram
    participant Buyer
    participant Frontend
    participant Contract
    participant Backend
    Buyer->>Frontend: Checkout cart
    Frontend->>Contract: purchaseBatch(cropIds, units, msg.value)
    Contract-->>Backend: CropPurchased events (per item)
    Backend-->>Backend: Confirm each Transaction + reduce quantities
```

### Gas Usage Notes

Gas depends on crop count, batch size, and Ganache configuration. Typical ranges on local Ganache:
- `listCrop`: ~80k to 150k gas
- `purchaseCrop` / `purchaseUnits`: ~60k to 120k gas
- `purchaseBatch`: base + ~30k to 50k per item

If you see large gas costs in MetaMask:
- Reduce batch size
- Ensure Ganache gas price is reasonable
- Use smaller data payloads (avoid overly long `offchainId`)

### Settlement and Value Precision

The contract uses wei (integer) for all values:
- `pricePerUnit` is stored in wei
- `value` in `CropPurchased` is wei
- Frontend converts to ETH for display

Precision rules:
- UI converts INR -> ETH using live rate
- ETH to wei uses `ethers.parseEther`
- On-chain only accepts integer wei values

## Key API Endpoints

Auth
- `GET /auth/nonce?wallet=0x...`
- `POST /auth/verify`
- `POST /auth/admin`

Users
- `POST /users/register`
- `GET /users/me`
- `GET /users/addresses`
- `POST /users/addresses`
- `PATCH /users/addresses/:id`
- `PATCH /users/addresses/:id/default`
- `DELETE /users/addresses/:id`
- `GET /users/admin`
- `POST /users/admin/:id/approve`
- `POST /users/admin/:id/reject`
- `POST /users/admin/:id/suspend`

Crops
- `GET /crops`
- `POST /crops`
- `GET /crops/mine`
- `GET /crops/admin/all`
- `POST /crops/admin/:id/approve`
- `POST /crops/admin/:id/reject`

Transactions
- `GET /transactions`
- `GET /transactions/admin`
- `POST /transactions/intent`
- `PATCH /transactions/:id/fulfillment`

Other
- `GET /ledger`
- `GET /rates/eth-inr`
- `GET /stats/marketplace`
- `GET /stats/admin`
- `GET /stats/farmer`
- `GET /stats/buyer`
- `POST /uploads`

## Environment Variables (Details)

Backend
- `PORT`: API server port
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: JWT signing secret
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`: Admin login
- `ADMIN_WALLET`: Admin wallet address (lowercase recommended)
- `ADMIN_PRIVATE_KEY`: Admin wallet private key for listing on-chain
- `GANACHE_RPC_URL`: Ganache JSON-RPC URL
- `CONTRACT_ADDRESS`: Deployed contract address
- `CONTRACT_ABI_PATH`: Path to ABI JSON (relative to backend)
- `CONTRACT_ABI_JSON`: Optional raw ABI JSON string
- `CORS_ORIGIN`: Frontend origin
- `EXPIRY_CHECK_INTERVAL_MS`: Expiry monitor interval
- `ETH_INR_RATE`: Fallback ETH/INR rate
- `ETH_RATE_CACHE_MS`: Cache TTL for ETH/INR fetch
- `TX_RECONCILE_INTERVAL_MS`: Sync pending tx receipts
- `TX_SYNC_ENABLED`: Enable past-event sync
- `TX_SYNC_FROM_BLOCK`: Start block for sync
- `TX_SYNC_LOOKBACK_BLOCKS`: Lookback if no start block
- `FULFILLMENT_CHECK_INTERVAL_MS`: Fulfillment monitor interval
- `FULFILLMENT_AUTO_SHIP_HOURS`: Auto-ship threshold
- `FULFILLMENT_AUTO_DELIVER_HOURS`: Auto-deliver threshold

Frontend
- `NEXT_PUBLIC_API_URL`: Backend base URL

Contracts
- `GANACHE_RPC_URL`: Used by Hardhat deploy

## Troubleshooting

“Blockchain listener active” but orders stay PENDING
- Ensure `CONTRACT_ADDRESS` and `CONTRACT_ABI_PATH` match the latest deploy
- Restart backend to re-run event sync
- Verify Ganache has not been reset

Ganache shows VALUE = 0.00
- Ganache rounds to 2 decimals. Small ETH values show as 0.00
- Check exact tx value using `eth_getTransactionByHash`

Insufficient funds
- Import a funded Ganache account into MetaMask
- Use that account for the buyer

“ABI not found”
- Confirm `CONTRACT_ABI_PATH` points to `contracts/deployments/ganache.json`

Orders empty
- Confirm you are logged in with the same wallet used to buy
- Backend queries match buyer wallet case-insensitively

## Sequence Diagrams

### User Registration and Approval

```mermaid
sequenceDiagram
    participant Buyer
    participant Frontend
    participant Backend
    participant Admin
    Buyer->>Frontend: Submit registration
    Frontend->>Backend: POST /users/register
    Backend-->>Frontend: status PENDING
    Admin->>Backend: Approve user
    Backend-->>Frontend: User ACTIVE
```

### Listing Approval and On-Chain Publish

```mermaid
sequenceDiagram
    participant Farmer
    participant Frontend
    participant Backend
    participant Admin
    participant Contract
    Farmer->>Frontend: Create listing
    Frontend->>Backend: POST /crops
    Backend-->>Admin: Listing pending
    Admin->>Backend: Approve listing
    Backend->>Contract: listCrop
    Contract-->>Backend: CropListed event
    Backend-->>Frontend: Listing APPROVED
```

### Purchase and Fulfillment

```mermaid
sequenceDiagram
    participant Buyer
    participant Frontend
    participant Backend
    participant Contract
    Buyer->>Frontend: Add to cart
    Buyer->>Frontend: Checkout
    Frontend->>Contract: purchaseBatch
    Contract-->>Backend: CropPurchased event
    Backend-->>Frontend: Order CONFIRMED
    Farmer->>Backend: Mark shipped
    Farmer->>Backend: Mark delivered
    Backend-->>Frontend: Timeline updated
```

## UI Walkthroughs

### Admin

1. Sign in using admin username and password.
2. Open Users to approve farmers and buyers.
3. Open Listings to review new crops and approve on-chain.
4. Open Transactions to monitor payments and ledger entries.
5. Use Emergency to pause or blacklist wallets if needed.

### Farmer

1. Register as FARMER and wait for admin approval.
2. Connect MetaMask and sign in.
3. Create a new listing with unit, pricing, and expiry.
4. Upload crop images and compliance certificate.
5. After admin approval, monitor orders in Farmer Orders.
6. Mark fulfillment status as SHIPPED then DELIVERED.

### Buyer

1. Register as BUYER and wait for admin approval.
2. Connect MetaMask and sign in.
3. Browse marketplace and filter by category or unit.
4. Add listings to cart and choose quantity.
5. Add or select shipping address and checkout.
6. Track payment and delivery timeline in My Orders.

## Development Notes

- Cart purchases call `purchaseBatch` and require items from the same farmer.
- Admin approval publishes listings to chain using the admin private key.
- Off-chain crop metadata is stored in MongoDB; only price and quantity are on-chain.
- Crop quantities are stored in base units for precise partial buying.

## Scripts

Contracts
- `npm run compile`
- `npm run deploy:ganache`

Backend
- `npm run dev`
- `npm run start`

Frontend
- `npm run dev`
- `npm run build`
- `npm run start`

## License
