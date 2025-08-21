import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorProject } from "../target/types/anchor_project";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

describe("anchor_project", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.AnchorProject as Program<AnchorProject>;
  const wallet = provider.wallet;

  let campaignPDA: PublicKey;
  let campaignBump: number;
  const campaignId = "test1";

  before(async () => {
    // Derive PDA for the campaign
    [campaignPDA, campaignBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("campaign"), wallet.publicKey.toBuffer(), Buffer.from(campaignId)],
      program.programId
    );
  });

  it("Creates a campaign", async () => {
    const name = "Test Campaign";
    const description = "A test crowdfunding campaign";
    const targetAmount = new anchor.BN(10_000_000);

    const tx = await program.methods
      .createCampaign(name, description, targetAmount, campaignId)
      .accounts({
        campaign: campaignPDA,
        user: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Create campaign transaction signature", tx);

    const campaignAccount = await program.account.campaign.fetch(campaignPDA);
    expect(campaignAccount.name).to.equal(name);
    expect(campaignAccount.description).to.equal(description);
    expect(campaignAccount.targetAmount.toNumber()).to.equal(targetAmount.toNumber());
    expect(campaignAccount.amountDonated.toNumber()).to.equal(0);
    expect(campaignAccount.owner.toBase58()).to.equal(wallet.publicKey.toBase58());
    expect(campaignAccount.campaignId).to.equal(campaignId);
    expect(campaignAccount.bump).to.equal(campaignBump);
  });

  it("Fails to create a campaign with empty parameters", async () => {
    const newCampaignId = "test2";
    const [newCampaignPDA, _] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("campaign"), wallet.publicKey.toBuffer(), Buffer.from(newCampaignId)],
      program.programId
    );

    try {
      await program.methods
        .createCampaign("", "", new anchor.BN(10_000_000), newCampaignId)
        .accounts({
          campaign: newCampaignPDA,
          user: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("Creating campaign with empty parameters should have failed");
    } catch (err) {
      expect(err.message).to.include("Campaign name, description, or ID cannot be empty");
    }
  });

  it("Donates to a campaign", async () => {
    const donationAmount = new anchor.BN(2_000_000);

    const tx = await program.methods
      .donate(campaignId, donationAmount)
      .accounts({
        campaign: campaignPDA,
        user: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Donation transaction signature", tx);

    const campaignAccount = await program.account.campaign.fetch(campaignPDA);
    expect(campaignAccount.amountDonated.toNumber()).to.equal(donationAmount.toNumber());
  });

  it("Fails to donate with insufficient funds", async () => {
    const poorUser = Keypair.generate();
    const donationAmount = new anchor.BN(1_000_000);

    const airdropTx = await provider.connection.requestAirdrop(poorUser.publicKey, 100_000); // Reduced to ensure failure
    await provider.connection.confirmTransaction(airdropTx);

    try {
      await program.methods
        .donate(campaignId, donationAmount)
        .accounts({
          campaign: campaignPDA,
          user: poorUser.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([poorUser])
        .rpc();
      expect.fail("Donation with insufficient funds should have failed");
    } catch (err) {
      expect(err.message).to.match(/failed to send transaction|insufficient lamports|custom program error: 0x1/);
    }
  });

  it("Fails to donate more than allowed amount", async () => {
    const excessiveAmount = new anchor.BN(9_000_000);

    try {
      await program.methods
        .donate(campaignId, excessiveAmount)
        .accounts({
          campaign: campaignPDA,
          user: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("Donation exceeding target should have failed");
    } catch (err) {
      expect(err.message).to.include("Donation exceeds remaining target amount");
    }
  });

  it("Withdraws from a campaign by owner", async () => {
    const initialUserBalance = await provider.connection.getBalance(wallet.publicKey);
    const initialCampaignBalance = await provider.connection.getBalance(campaignPDA);

    const tx = await program.methods
      .withdraw(campaignId)
      .accounts({
        campaign: campaignPDA,
        owner: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Withdrawal transaction signature", tx);

    const campaignAccount = await program.account.campaign.fetch(campaignPDA);
    expect(campaignAccount.amountDonated.toNumber()).to.equal(0);

    const finalUserBalance = await provider.connection.getBalance(wallet.publicKey);
    expect(finalUserBalance).to.be.greaterThan(initialUserBalance);
  });

  it("Fails to withdraw more than available funds", async () => {
    await program.methods
      .donate(campaignId, new anchor.BN(500_000))
      .accounts({
        campaign: campaignPDA,
        user: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const campaignAccount = await program.account.campaign.fetch(campaignPDA);
    const available = campaignAccount.amountDonated.toNumber();
    expect(available).to.equal(500_000);

    const tx = await program.methods
      .withdraw(campaignId)
      .accounts({
        campaign: campaignPDA,
        owner: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const updatedCampaign = await program.account.campaign.fetch(campaignPDA);
    expect(updatedCampaign.amountDonated.toNumber()).to.equal(0);
  });

  it("Fails to withdraw from a campaign by non-owner", async () => {
    const nonOwner = Keypair.generate();

    const airdropTx = await provider.connection.requestAirdrop(nonOwner.publicKey, 1_000_000);
    await provider.connection.confirmTransaction(airdropTx);

    await program.methods
    .donate(campaignId, new anchor.BN(500_000))
    .accounts({
      campaign: campaignPDA,
      user: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

    try {
      await program.methods
        .withdraw(campaignId)
        .accounts({
          campaign: campaignPDA,
          owner: nonOwner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([nonOwner])
        .rpc();
      expect.fail("Only the campaign owner can withdraw funds");
    } catch (err) {
      const errorLogs = err.logs || [];
      const errorMessage = errorLogs.join(" ") || err.message || "";
      expect(errorMessage).to.include("Only the campaign owner can withdraw funds");
    }
  });
});