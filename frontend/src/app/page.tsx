"use client";

import { useState, useEffect } from "react";
import {
  Program,
  AnchorProvider,
  web3,
  BN,
  Idl,
} from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import dynamic from "next/dynamic";

import { LAMPORTS_PER_SOL } from "@solana/web3.js";

const toLamports = (sol: string) =>
  new BN(Math.floor(parseFloat(sol) * LAMPORTS_PER_SOL));

const fromLamports = (lamports: BN | number | string) => {
  const val = typeof lamports === "string" ? parseInt(lamports) : lamports;
  return (Number(val) / LAMPORTS_PER_SOL).toFixed(3);
};

const WalletButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

const programID = new PublicKey("H9WF79zZKbKfyLvsBkmeLsFcaqF2pwJwKz9E5feuF83q");

type Toast = {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  message?: string;
};

export default function Home() {
  const wallet = useWallet();
  const { connection } = useConnection();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState("");
  const [createCampaignId, setCreateCampaignId] = useState("");

  const [donateOwner, setDonateOwner] = useState("");
  const [donateCampaignId, setDonateCampaignId] = useState("");
  const [donateAmount, setDonateAmount] = useState("");

  const [withdrawOwner, setWithdrawOwner] = useState("");
  const [withdrawCampaignId, setWithdrawCampaignId] = useState("");

  const [status, setStatus] = useState("");
  const [mounted, setMounted] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);

  const [allCampaigns, setAllCampaigns] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showToast = (toast: Omit<Toast, "id">, lifetime = 10000) => {
    const id = `${Date.now()}-${Math.random()}`;
    const t: Toast = { id, ...toast };
    setToasts((s) => [t, ...s]);
    setTimeout(() => {
      setToasts((s) => s.filter((x) => x.id !== id));
    }, lifetime);
  };

  const getProvider = () => {
    if (!wallet || !wallet.publicKey) return null;
    return new AnchorProvider(connection, wallet as any, {
      preflightCommitment: "processed",
    });
  };

  const getProgram = async () => {
    if (!wallet || !wallet.publicKey) throw new Error("Wallet not connected");
    const provider = new AnchorProvider(connection, wallet as any, {
      preflightCommitment: "processed",
    });

    const fetched = await Program.fetchIdl(programID, provider);
    if (!fetched) {
      throw new Error(
        "No Anchor IDL found on-chain for this program. "
      );
    }
    return new Program(fetched as Idl, provider);
  };

  const deriveCampaignPDA = (
    owner: PublicKey,
    campaignId: string,
    programId: PublicKey
  ): PublicKey => {
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("campaign"),
        owner.toBuffer(),
        Buffer.from(campaignId, "utf8"),
      ],
      programId
    );
    return pda;
  };

  const createCampaign = async () => {
    try {
      if (!wallet.publicKey) throw new Error("Wallet not connected");

      if (!createCampaignId || !name || !description || !target) {
        setStatus("❌ Please fill in all fields before creating a campaign");
        showToast({ type: "error", title: "Missing fields", message: "Fill all missing fields" });
        return;
      }

      const program = await getProgram();
      if (!program) throw new Error("Program not available");

      const campaignPDA = deriveCampaignPDA(wallet.publicKey, createCampaignId, program.programId);

      const acc = await connection.getAccountInfo(campaignPDA);
      if (acc) {
        const msg = `Campaign with id "${createCampaignId}" already exists (PDA ${campaignPDA.toBase58()})`;
        setStatus(`❌ ${msg}`);
        showToast({ type: "error", title: "Campaign exists", message: msg });
        return;
      }

      const targetLamports = toLamports(target);
      if (targetLamports.isZero()) {
        setStatus("❌ Target amount must be greater than 0");
        showToast({ type: "error", title: "Invalid target", message: "Target must be > 0" });
        return;
      }

      await program.methods
        .createCampaign(name, description, targetLamports, createCampaignId)
        .accounts({
          campaign: campaignPDA,
          user: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const successMsg = `Campaign "${name}" created successfully! PDA: ${campaignPDA.toBase58()}`;
      setStatus(`✅ ${successMsg}`);
      showToast({ type: "success", title: "Campaign created", message: successMsg });

      setCreateCampaignId("");
      setName("");
      setDescription("");
      setTarget("");

      await fetchAllCampaigns();
    } catch (err: any) {
      console.error("Create campaign error:", err);
      const message = err.message?.includes("AnchorError")
        ? err.message.match(/Error Message: (.+?)\./)?.[1] || "Unknown error creating campaign"
        : err.message || String(err);
      setStatus(`❌ Error: ${message}`);
      showToast({ type: "error", title: "Create failed", message });
    }
  };

  const donate = async () => {
    try {
      if (!wallet.publicKey) throw new Error("Wallet not connected");
      const program = await getProgram();
      if (!program) throw new Error("Program not available");

      if (!donateOwner || !donateCampaignId || !donateAmount) {
        showToast({ type: "error", title: "Missing fields", message: "Provide campaign owner, id, and amount" });
        return;
      }

      const ownerPub = new PublicKey(donateOwner);
      const campaignPDA = deriveCampaignPDA(ownerPub, donateCampaignId, program.programId);

      const acc = await connection.getAccountInfo(campaignPDA);
      if (!acc) {
        const msg = `Campaign not found for id ${donateCampaignId} owner ${ownerPub.toBase58()}`;
        setStatus(`❌ ${msg}`);
        showToast({ type: "error", title: "Not found", message: msg });
        return;
      }

      const donateLamports = toLamports(donateAmount);
      if (donateLamports.isZero()) {
        setStatus("❌ Donation amount must be greater than 0");
        showToast({ type: "error", title: "Invalid amount", message: "Amount must be > 0" });
        return;
      }

      await program.methods
        .donate(donateCampaignId, donateLamports)
        .accounts({
          campaign: campaignPDA,
          user: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const successMsg = `Donated ${donateAmount} SOL to campaign ${donateCampaignId} (PDA ${campaignPDA.toBase58()})`;
      setStatus(`✅ ${successMsg}`);
      showToast({ type: "success", title: "Donation successful", message: successMsg });

      setDonateAmount("");
      setDonateCampaignId("");
      setDonateOwner("");

      await fetchAllCampaigns();
    } catch (err: any) {
      console.error("Donate error:", err);
      let message = "Unknown error donating to campaign";
      if (err.message?.includes("AnchorError")) {
        message = err.message.match(/Error Message: (.+?)\./)?.[1] || message;
      } else if (err.logs?.some((log: string) => log.includes("insufficient lamports"))) {
        message = "Insufficient funds in wallet";
      } else {
        message = err.message || String(err);
      }
      setStatus(`❌ Error: ${message}`);
      showToast({ type: "error", title: "Donate failed", message });
    }
  };

  const withdraw = async () => {
    try {
      if (!wallet.publicKey) throw new Error("Wallet not connected");
      const program = await getProgram();
      if (!program) throw new Error("Program not available");

      if (!withdrawOwner || !withdrawCampaignId) {
        showToast({ type: "error", title: "Missing fields", message: "Provide campaign owner and id" });
        return;
      }

      const ownerPub = new PublicKey(withdrawOwner);
      const campaignPDA = deriveCampaignPDA(ownerPub, withdrawCampaignId, program.programId);

      const acc = await connection.getAccountInfo(campaignPDA);
      if (!acc) {
        const msg = `Campaign not found for id ${withdrawCampaignId} owner ${ownerPub.toBase58()}`;
        setStatus(`❌ ${msg}`);
        showToast({ type: "error", title: "Not found", message: msg });
        return;
      }

      const campaignAccount = await program.account.campaign.fetch(campaignPDA);
      const availableLamports = acc.lamports - (await connection.getMinimumBalanceForRentExemption(364));
      const availableSol = fromLamports(availableLamports);

      await program.methods
        .withdraw(withdrawCampaignId)
        .accounts({
          campaign: campaignPDA,
          owner: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const successMsg = `Withdrew ${availableSol} SOL from campaign ${withdrawCampaignId} (PDA ${campaignPDA.toBase58()})`;
      setStatus(`✅ ${successMsg}`);
      showToast({ type: "success", title: "Withdraw successful", message: successMsg });

      setWithdrawCampaignId("");
      setWithdrawOwner("");

      await fetchAllCampaigns();
    } catch (err: any) {
      console.error("Withdraw error:", err);
      const message = err.message?.includes("AnchorError")
        ? err.message.match(/Error Message: (.+?)\./)?.[1] || "Unknown error withdrawing funds"
        : err.message || String(err);
      setStatus(`❌ Error: ${message}`);
      showToast({ type: "error", title: "Withdraw failed", message });
    }
  };

  const fetchAllCampaigns = async () => {
    try {
      const program = await getProgram();
      if (!program) return;

      const accounts = await program.account.campaign.all();
      console.log("Raw campaign accounts:", accounts);
      const parsed = await Promise.all(
        accounts.map(async (c) => {
          const createdAt = c.account.createdAt ? c.account.createdAt.toString() : "0";
          const accountInfo = await connection.getAccountInfo(c.publicKey);
          const rentExemptMinimum = await connection.getMinimumBalanceForRentExemption(364);
          const targetMet = new BN(c.account.amountDonated).gte(new BN(c.account.targetAmount));
          const withdrawn = c.account.withdrawn === true; 
          console.log(`Campaign ${c.account.name}: createdAt = ${createdAt}, targetMet = ${targetMet}, withdrawn = ${withdrawn}, amountDonated = ${c.account.amountDonated}, targetAmount = ${c.account.targetAmount}, lamports = ${accountInfo?.lamports}, rentExemptMinimum = ${rentExemptMinimum}, withdrawnFlag = ${c.account.withdrawn}`); // Debug
          return {
            pda: c.publicKey.toBase58(),
            owner: c.account.owner.toBase58(),
            campaignId: c.account.campaignId,
            name: c.account.name,
            description: c.account.description,
            target: c.account.targetAmount.toString(),
            amountDonated: c.account.amountDonated.toString(),
            createdAt,
            targetMet,
            withdrawn,
          };
        })
      );
      parsed.sort((a, b) => {
        const aTime = Number(a.createdAt);
        const bTime = Number(b.createdAt);
        if (aTime === 0 && bTime === 0) return a.name.localeCompare(b.name);
        return bTime - aTime;
      });
      console.log("Sorted campaigns:", parsed);
      setAllCampaigns(parsed);
    } catch (err) {
      console.error("Error fetching campaigns:", err);
      showToast({ type: "error", title: "Fetch failed", message: "Could not load campaigns" });
    }
  };

  useEffect(() => {
    if (wallet.publicKey) {
      fetchAllCampaigns();
    }
  }, [wallet.publicKey]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Toast area */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`p-3 rounded-lg shadow-md max-w-sm bg-black text-white border-l-4 ${
              t.type === "success"
                ? "border-green-500"
                : t.type === "error"
                ? "border-red-500"
                : "border-blue-500"
            }`}
          >
            <div className="font-semibold">{t.title}</div>
            {t.message && <div className="text-sm mt-1">{t.message}</div>}
          </div>
        ))}
      </div>

      <h1 className="text-3xl font-bold mb-4">Crowdfunding dApp</h1>

      {mounted && <WalletButton />}

      {/* Create Campaign */}
      <div className="mt-6 space-y-4">
        <h2 className="text-xl font-semibold">Create Campaign</h2>
        <input
          className="w-full border p-2 rounded"
          placeholder="Campaign ID (unique)"
          value={createCampaignId}
          onChange={(e) => setCreateCampaignId(e.target.value)}
        />
        <input
          className="w-full border p-2 rounded"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <textarea
          className="w-full border p-2 rounded"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          className="w-full border p-2 rounded"
          placeholder="Target amount (in SOL)"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
        <button className="bg-blue-500 text-white px-4 py-2 rounded" onClick={createCampaign}>
          Create
        </button>
      </div>

      {/* Donate */}
      <div className="mt-6 space-y-4">
        <h2 className="text-xl font-semibold">Donate</h2>
        <input
          className="w-full border p-2 rounded"
          placeholder="Campaign Owner PublicKey"
          value={donateOwner}
          onChange={(e) => setDonateOwner(e.target.value)}
        />
        <input
          className="w-full border p-2 rounded"
          placeholder="Campaign ID"
          value={donateCampaignId}
          onChange={(e) => setDonateCampaignId(e.target.value)}
        />
        <input
          className="w-full border p-2 rounded"
          placeholder="Donation amount (in SOL)"
          value={donateAmount}
          onChange={(e) => setDonateAmount(e.target.value)}
        />
        <button className="bg-green-500 text-white px-4 py-2 rounded" onClick={donate}>
          Donate
        </button>
      </div>

      {/* Withdraw */}
      <div className="mt-6 space-y-4">
        <h2 className="text-xl font-semibold">Withdraw</h2>
        <input
          className="w-full border p-2 rounded"
          placeholder="Campaign Owner PublicKey"
          value={withdrawOwner}
          onChange={(e) => setWithdrawOwner(e.target.value)}
        />
        <input
          className="w-full border p-2 rounded"
          placeholder="Campaign ID"
          value={withdrawCampaignId}
          onChange={(e) => setWithdrawCampaignId(e.target.value)}
        />
        <button className="bg-red-500 text-white px-4 py-2 rounded" onClick={withdraw}>
          Withdraw All
        </button>
      </div>

      <p className="mt-6 text-gray-700">{status}</p>

      {/* All campaigns from chain */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold">All On-chain Campaigns</h2>
        {allCampaigns.length === 0 ? (
          <p className="text-sm text-gray-500">No campaigns found on-chain</p>
        ) : (
          <div className="mt-4 space-y-3">
            {allCampaigns.map((c) => (
              <div key={c.pda} className="border-3 p-3 rounded shadow-sm">
                <div className="font-semibold">Campaign Name: {c.name}</div>
                <div className="text-sm">Campaign ID: {c.campaignId}</div>
                <div className="text-sm">Owner: {c.owner}</div>
                <div className="text-sm">PDA: {c.pda}</div>
                <div className="text-sm">Target: {fromLamports(c.target)} SOL</div>
                <div className="text-sm">Campaign Balance: {fromLamports(c.amountDonated)} SOL</div>
                <div className="text-sm">
                  Created: {c.createdAt !== "0" ? new Date(Number(c.createdAt) * 1000).toLocaleString() : "Unknown"}
                </div>
                <div className="text-sm">
                  Funds: {c.withdrawn ? "Withdrawn ✅" : "Not Withdrawn ❌"}
                </div>
                <div className="mt-2 text-sm">{c.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}