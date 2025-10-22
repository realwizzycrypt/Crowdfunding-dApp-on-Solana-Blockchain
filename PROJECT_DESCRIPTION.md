# Project Description

**Deployed Frontend URL:** https://program-realwizzycrypt.vercel.app/

**Solana Program ID:** H9WF79zZKbKfyLvsBkmeLsFcaqF2pwJwKz9E5feuF83q

## Project Overview

### Description
This is a decentralized crowdfunding application built on Solana using the Anchor framework. The dApp allows users to create fundraising campaigns, donate SOL to existing campaigns, and withdraw funds as the campaign owner. Each campaign is uniquely identified by a campaign ID and stored in a Program Derived Address (PDA) to ensure secure and deterministic account management. The frontend, built with create-solana-dapp (Next.js), provides an intuitive interface for users to interact with the Solana program, view all on-chain campaigns, and perform actions like creating, donating to, or withdrawing from campaigns.

### Key Features
- **Create Campaign**: Users can initialize a new crowdfunding campaign with a unique ID, name, description, and target amount in SOL.
- **Donate to Campaign**: Users can contribute SOL to any campaign by specifying the campaign ID and owner’s public key.
- **Withdraw Funds**: Campaign owners can withdraw collected funds, minus rent-exempt lamports, from their campaign.
- **View Campaigns**: Displays all on-chain campaigns with details like name, description, target amount, amount donated, and withdrawal status.
- **Error Handling**: Robust validation prevents invalid actions, such as donating more than the target amount or withdrawing by non-owners.

### How to Use the dApp
1. **Connect Wallet**:
   - Click the "Connect Wallet" button to connect your Solana wallet (e.g., Phantom) to the dApp.
2. **Create a Campaign**:
   - Enter a unique Campaign ID, Name, Description, and Target Amount (in SOL).
   - Click "Create" to initialize the campaign on-chain.
3. **Donate to a Campaign**:
   - Input the Campaign Owner’s PublicKey, Campaign ID, and Donation Amount (in SOL).
   - Click "Donate" to contribute to the specified campaign.
4. **Withdraw Funds**:
   - As the campaign owner, input your PublicKey and the Campaign ID.
   - Click "Withdraw All" to transfer available funds to your wallet.
5. **View Campaigns**:
   - Scroll to the "All On-chain Campaigns" section to see a list of campaigns with their details, including PDA, owner, target, and donated amounts.

## Program Architecture
The Solana program is built using Anchor, with three main instructions: `createCampaign`, `donate`, and `withdraw`. It uses a single account type, `Campaign`, to store campaign details. PDAs ensure unique campaign accounts, and events are emitted for transparency (e.g., `CampaignCreated`, `DonationMade`, `WithdrawalMade`). The frontend integrates with the Solana blockchain via the Anchor client and Solana Web3.js, handling user inputs and displaying real-time campaign data.

### PDA Usage
The program uses Program Derived Addresses (PDAs) to create deterministic campaign accounts based on the owner’s public key and campaign ID.

**PDAs Used:**
- **Campaign PDA**: Derived from seeds `["campaign", owner_pubkey, campaign_id]` - ensures each campaign is uniquely addressable and only modifiable by authorized instructions. The seeds tie the campaign to its owner and ID, preventing collisions and ensuring secure access control.

### Program Instructions
**Instructions Implemented:**
- **createCampaign**: Initializes a new campaign account with the provided name, description, target amount, and campaign ID. Validates that inputs are non-empty and emits a `CampaignCreated` event.
- **donate**: Transfers SOL from the user to the campaign account, ensuring the donation doesn’t exceed the remaining target amount. Updates the `amountDonated` field and emits a `DonationMade` event.
- **withdraw**: Allows the campaign owner to withdraw available funds (minus rent-exempt lamports) from the campaign account. Validates ownership and sufficient funds, updates the account, and emits a `WithdrawalMade` event.

### Account Structure
```rust
#[account]
#[derive(InitSpace)]
pub struct Campaign {
    pub owner: Pubkey,            // The wallet that created the campaign
    #[max_len(50)]
    pub name: String,             // Campaign name (up to 50 characters)
    #[max_len(200)]
    pub description: String,      // Campaign description (up to 200 characters)
    pub amountDonated: u64,       // Total SOL donated to the campaign
    pub targetAmount: u64,        // Target fundraising amount
    #[max_len(32)]
    pub campaignId: String,       // Unique identifier for the campaign
    pub bump: u8,                 // PDA bump seed for validation
    pub createdAt: u64,           // Unix timestamp of campaign creation
    pub withdrawn: bool,          // Flag indicating if funds have been withdrawn
}
```

## Testing

### Test Coverage
The test suite, written in TypeScript using Anchor’s testing framework, covers both happy and unhappy paths to ensure program robustness. Tests validate core functionality and error conditions, simulating real-world usage.

**Happy Path Tests:**
- **Create Campaign**: Verifies successful campaign creation with correct initialization of name, description, target amount, and owner.
- **Donate to Campaign**: Confirms donations are correctly recorded and update the `amountDonated` field.
- **Withdraw by Owner**: Ensures the campaign owner can withdraw funds, reducing `amountDonated` to zero and transferring lamports to the owner.

**Unhappy Path Tests:**
- **Create with Empty Parameters**: Fails when name, description, amount, or campaign ID is empty.
- **Donate with Insufficient Funds**: Fails when the user’s wallet lacks sufficient lamports.
- **Donate Exceeding Target**: Fails when the donation amount exceeds the remaining target.
- **Withdraw by Non-Owner**: Fails when a non-owner attempts to withdraw funds.
- **Withdraw with Insufficient Funds**: Ensures withdrawal fails if no funds are available beyond rent-exempt lamports.

### Running Tests
```bash
yarn install    # Install dependencies
# or
npm install    # Install dependencies
anchor test     # Run the test suite
```

### Additional Notes for Evaluators
This project was developed to explore Solana’s Anchor framework and build a practical dApp with real-world utility. The biggest challenges were ensuring secure PDA derivation and handling edge cases like rent-exempt lamports. The frontend’s real-time campaign fetching and toast notifications enhance user experience, while the test suite provides confidence in the program’s reliability. Future improvements could include adding campaign expiration dates or multi-signature withdrawals for enhanced security.