import React from 'react';

const ProtocolSpecs: React.FC = () => {
  const specs = [
    {
      title: "FHE Architecture",
      points: [
        "Inco Lightning L3: Powered by Lattice-based FHE for secure off-chain encrypted computation.",
        "Euint128 Handles: All balances are stored as 128-bit references to encrypted ciphertexts."
      ]
    },
    {
      title: "Privacy Protocol",
      points: [
        "Confidential Transfers: Amount validation and movement occur entirely on encrypted data.",
        "Stealth Notes: Recipient wallet addresses are never visible on-chain during the transfer process."
      ]
    },
    {
      title: "Security & Auth",
      points: [
        "Attested Reveal: Decryption requires a wallet-signed message verified by Inco Covalidators.",
        "Non-Deterministic: Every operation produces a unique handle, preventing pattern analysis."
      ]
    }
  ];

  return (
    <section className="py-24 px-12 bg-[#020202]">
      <div className="max-w-4xl">
        <div className="text-[10px] mono text-[#444444] uppercase tracking-[0.4em] mb-12">Protocol_Confidentiality_Framework</div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {specs.map((spec, i) => (
            <div key={i} className="space-y-6">
              <h3 className="text-[11px] font-bold text-white uppercase tracking-[0.2em] border-b border-[#141414] pb-4">
                {spec.title}
              </h3>
              <ul className="space-y-4">
                {spec.points.map((point, j) => (
                  <li key={j} className="text-[12px] text-[#666666] leading-relaxed font-light">
                    • {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-20 p-8 border border-[#141414] bg-black flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex gap-4 items-center">
            <div className="w-2 h-2 rounded-full bg-green-950 animate-pulse" />
            <span className="text-[10px] mono text-[#444444] uppercase tracking-widest">Hardware_Attestation: VERIFIED</span>
          </div>
          <div className="text-[9px] mono text-[#222222] uppercase tracking-[0.2em]">
            FHE_LATTICE_V3 // ENCLAVE_SYNC_STABLE
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProtocolSpecs;