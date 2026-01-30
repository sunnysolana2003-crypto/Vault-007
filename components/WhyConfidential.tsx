import React from 'react';

const theses = [
  {
    topic: "Visibility Risk",
    description: "On transparent ledgers, trade intent is public. Vault-007 obscures execution data, preventing front-running and copy-trading of proprietary strategies."
  },
  {
    topic: "Asset Privacy",
    description: "Institutional participants require non-disclosure of holdings. Every balance and historical position is encrypted at the protocol level, visible only to authorized keys."
  },
  {
    topic: "MEV Neutralization",
    description: "Inco Lightning's encryption hides transaction payloads from block producers, structurally neutralizing atomic arbitrage and sandwich attacks."
  }
];

const WhyConfidential: React.FC = () => {
  return (
    <section className="py-24 px-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
        <div className="lg:col-span-4">
          <div className="text-[10px] mono text-[#444444] uppercase tracking-[0.3em] mb-4">Thesis_Statement</div>
          <h2 className="text-3xl font-bold text-white tracking-tight mb-6 uppercase">Structural Privacy.</h2>
          <p className="text-[13px] text-[#777777] leading-relaxed max-w-xs font-light">
            Protocol-level confidentiality is not a feature; it is a fundamental requirement for institutional liquidity management.
          </p>
        </div>
        
        <div className="lg:col-span-8 border border-[#141414]">
          {theses.map((thesis, idx) => (
            <div key={idx} className="p-10 border-b last:border-b-0 border-[#141414] flex flex-col md:flex-row gap-8 items-start hover:bg-neutral-900/10 transition-colors">
              <span className="text-[10px] mono text-[#222222] font-bold">0{idx + 1}</span>
              <div className="flex-1">
                <h3 className="text-[12px] font-bold text-white mb-2 uppercase tracking-[0.2em]">{thesis.topic}</h3>
                <p className="text-[14px] text-[#888888] leading-relaxed font-light">
                  {thesis.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyConfidential;