import React from 'react';

const stages = [
  {
    name: "Key Generation & Wrapping",
    desc: "Assets enter the confidential pool and are wrapped with FHE certificates. Ownership is decoupled from public wallet addresses."
  },
  {
    name: "Strategy Execution",
    desc: "Deployment of capital into algorithmic vaults via cross-program invocation. Execution remains invisible to global network observers."
  },
  {
    name: "Private Settlement",
    desc: "Yield accrual and rebalancing logic execute within an encrypted state. Solvency is verifiable via zero-knowledge proofs."
  }
];

const HowItWorks: React.FC = () => {
  return (
    <section className="py-24 px-12">
      <div className="max-w-4xl">
        <div className="text-[10px] mono text-[#444444] uppercase tracking-[0.3em] mb-6">Deployment_Cycle</div>
        <h2 className="text-4xl font-bold text-white mb-20 tracking-tight uppercase">Operational Workflow</h2>

        <div className="space-y-20 border-l border-[#141414] pl-10 ml-2">
          {stages.map((stage, idx) => (
            <div key={idx} className="relative">
              <div className="absolute -left-[45px] top-0 w-2 h-2 bg-neutral-800 rounded-full border border-black shadow-[0_0_0_4px_black]" />
              <div className="max-w-xl">
                <h3 className="text-[11px] mono text-[#333333] mb-2 uppercase tracking-[0.2em]">Phase_0{idx + 1}</h3>
                <h4 className="text-xl font-bold text-white mb-4 uppercase tracking-wider">{stage.name}</h4>
                <p className="text-[14px] text-[#777777] leading-relaxed font-light">{stage.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;