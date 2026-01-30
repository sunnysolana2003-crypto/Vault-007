import React from 'react';

const ProtocolSpecs: React.FC = () => {
  const specs = [
    {
      title: "State Encryption",
      points: [
        "Lattice-Based FHE: Individual balances and strategy allocations are stored as ciphertexts.",
        "Inco Lightning L3: Dedicated confidential subnet isolation from public L1 compute."
      ]
    },
    {
      title: "Disclosure Policy",
      points: [
        "Public: Aggregated TVL, network heartbeat, and ZK-Recursive audit attestations.",
        "Private: Individual holdings, trade parameters, and active yield strategy IDs."
      ]
    },
    {
      title: "Session Security",
      points: [
        "Explicit Auth: Decryption requires a signed cryptographic handshake.",
        "Atomic Redaction: Immediate state purge upon wallet disconnect or tab blur."
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