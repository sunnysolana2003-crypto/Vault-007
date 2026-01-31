# Vault-007 Architecture Diagram

```mermaid
graph TD
    subgraph Client ["Client Side (Browser)"]
        User["User Wallet (Phantom/Solflare)"]
        Frontend["React 19 Frontend"]
        IncoSDK["@inco/solana-sdk"]
        BrowserCrypto["Web Crypto API (SHA256/Ed25519)"]
        
        Frontend -->|"1. Encrypt Amount"| IncoSDK
        Frontend -->|"4. Sign Handle"| User
        Frontend -->|"5. Verify Signature"| BrowserCrypto
    end

    subgraph Solana ["Solana Blockchain (Devnet)"]
        Program["Vault-007 Anchor Program"]
        VaultPDA["Vault PDA (Global State)"]
        UserPDA["UserPosition PDA (User State)"]
        NotePDA["StealthNote PDA (Note State)"]
        
        Program -->|"Read/Write"| VaultPDA
        Program -->|"Read/Write"| UserPDA
        Program -->|"Read/Write"| NotePDA
    end

    subgraph Inco ["Inco Network (FHE Layer)"]
        IncoProgram["Inco Lightning Program"]
        Covalidator["Inco Covalidator API"]
        
        Program -->|"CPI: e_add, e_sub, e_ge"| IncoProgram
        Frontend -->|"6. Fetch Plaintext"| Covalidator
    end

    %% Flow: Deposit
    User -->|"2. Send Tx (Ciphertext)"| Program
    Program -->|"3. FHE Math"| IncoProgram
    
    %% Flow: Decrypt
    Covalidator -.->|"7. Plaintext"| Frontend

    %% Styling
    style User fill:#222,stroke:#444,color:#fff
    style Frontend fill:#050505,stroke:#00d4aa,color:#fff
    style Program fill:#111,stroke:#9945ff,color:#fff
    style IncoProgram fill:#111,stroke:#00d4aa,color:#fff
```

## Component Breakdown

### 1. Frontend (React 19)
- **VaultContext**: Manages global state, wallet connection, and FHE operations.
- **VaultService**: The bridge between the UI and the Solana/Inco protocols.
- **Components**: Terminal-style UI for Deposit, Withdraw, Transfer, and Stealth Notes.

### 2. Backend (Anchor/Rust)
- **Instructions**:
    - `deposit`: Moves SOL to escrow and adds encrypted amount to balance.
    - `withdraw`: Subtracts encrypted amount and releases SOL from escrow.
    - `transfer`: Private movement of funds between two user PDAs.
    - `claim_stealth_note`: Secret-based fund claiming with hidden recipient.
    - `apply_yield`: Global yield distribution via index update.
- **State**:
    - `Vault`: Stores total encrypted balance and global yield index.
    - `UserPosition`: Stores individual encrypted balance and last observed yield index.

### 3. FHE Layer (Inco Lightning)
- **Handles**: 128-bit references to ciphertexts stored on Inco.
- **CPI Operations**: Arithmetic performed by Inco validators without decrypting data.
- **Attestation**: Cryptographic proof that a user is authorized to decrypt a specific handle.
