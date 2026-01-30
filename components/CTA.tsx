import React from 'react';

const CTA: React.FC = () => {
  return (
    <section className="py-40 px-12 flex items-center justify-center text-center">
      <div className="max-w-2xl">
        <div className="text-[10px] mono text-[#444444] uppercase tracking-[0.3em] mb-6">Access_Request</div>
        <h2 className="text-5xl font-bold text-white mb-8 tracking-tighter uppercase">Join the Protocol.</h2>
        <p className="text-[#777777] text-lg mb-12 font-light leading-relaxed">
          Vault-007 is accepting early access participants.
          Deployments run on Solana with Inco Lightning encrypted compute.
        </p>
        
        <div className="flex flex-col items-center gap-8">
          <button className="px-16 py-5 bg-white text-black text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-neutral-200 transition-colors shadow-2xl">
            Request Terminal Access
          </button>
          
          <div className="pt-8 border-t border-[#141414] w-full flex flex-col items-center">
            <span className="text-[10px] mono text-[#333333] uppercase tracking-widest mb-2">Protocol_Uptime</span>
            <span className="text-[12px] text-[#555555] mono">99.998% // 24/7 ENCRYPTED OPS</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;