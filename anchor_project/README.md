# anchor_project

This is the **Solana Anchor program** for the `program-realwizzycrypt` project.  
It contains the on-chain smart contract code, written in Rust and managed with [Anchor](https://book.anchor-lang.com/).

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/School-of-Solana/program-realwizzycrypt.git
cd program-realwizzycrypt/anchor_project
```

### 2. Install Dependencies
Make sure you have the following installed:

- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) (v1.18+ recommended)
- [Anchor CLI](https://book.anchor-lang.com/getting_started/installation.html)  
```bash
  cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
  avm install latest
  avm use latest
```

Node.js
 (18+ for running tests with Anchor’s JS client)

### 3. Build the Program

From the anchor_project folder:
```bash
anchor build
```

This will compile the Rust smart contract and generate the IDL in the target/idl directory.

### 4. Run a Local Validator

Start a local Solana test validator:
```bash
solana-test-validator
```

In another terminal, deploy your program:
```bash
anchor deploy
```

### 5. Run Tests

Anchor integrates with Mocha/TypeScript for testing.
To run the test suite:
```bash
anchor test
```

### ⚠️ Notes

- Make sure your program ID is set correctly:

- Update Anchor.toml → [programs.localnet]

- Update declare_id! inside your Rust program’s lib.rs

If you change the program ID, regenerate the IDL by running:
```bash
anchor build
```

Tests are located in the tests/ directory and interact with the program using the generated IDL.
