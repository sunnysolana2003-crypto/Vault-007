import React, { useState, useEffect } from 'react';
import { VaultProvider, useVault } from './context/VaultContext';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import WhyConfidential from './components/WhyConfidential';
import HowItWorks from './components/HowItWorks';
import VaultTerminal from './components/VaultTerminal';
import ProtocolSpecs from './components/ProtocolSpecs';
import CTA from './components/CTA';
import WalletModal from './components/WalletModal';
import OnboardingTour from './components/OnboardingTour';

const AppContent: React.FC = () => {
  const { showWalletModal, setShowWalletModal, handleWalletSelect } = useVault();
  const [runTour, setRunTour] = useState(false);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('vault007_tour_seen');
    if (!hasSeenTour) {
      // Delay tour slightly for better UX
      const timer = setTimeout(() => setRunTour(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleTourFinish = () => {
    setRunTour(false);
    localStorage.setItem('vault007_tour_seen', 'true');
  };

  return (
    <>
      <OnboardingTour run={runTour} onFinish={handleTourFinish} />
      <div className="relative min-h-screen bg-black text-white selection:bg-white selection:text-black">
        <Navbar />
        
        <main className="max-w-[1280px] mx-auto border-x border-[#141414]">
          <div id="hero">
            <Hero />
          </div>
          
          <div id="terminal" className="border-t border-[#141414]">
            <VaultTerminal />
          </div>

          <div id="features" className="border-t border-[#141414]">
            <WhyConfidential />
          </div>

          <div id="specs" className="border-t border-[#141414]">
            <ProtocolSpecs />
          </div>
          
          <div id="implementation" className="border-t border-[#141414]">
            <HowItWorks />
          </div>
          
          <div id="access" className="border-t border-[#141414]">
            <CTA />
          </div>
        </main>

        <footer className="py-16 border-t border-[#141414]">
          <div className="max-w-[1280px] mx-auto px-12 grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] mb-4">PRIVATE_ALPHA_PROTOCOL</div>
              <p className="text-[#555555] text-[10px] mono leading-relaxed max-w-xs">
                SYSTEM_ID: SOL_INCO_ENCRYPTED_L3<br />
                COMPLIANCE: FHE_STANDARDS_V1<br />
                © 2024. ALL RIGHTS RESERVED.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-20 gap-y-8">
              <div className="flex flex-col gap-2">
                <span className="text-[10px] uppercase tracking-widest text-[#333333] font-semibold">Infrastructure</span>
                <a href="#" className="text-[11px] text-[#777777] hover:text-white transition-colors">Documentation</a>
                <a href="#" className="text-[11px] text-[#777777] hover:text-white transition-colors">Protocol Specs</a>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[10px] uppercase tracking-widest text-[#333333] font-semibold">Security</span>
                <a href="#" className="text-[11px] text-[#777777] hover:text-white transition-colors">Audit History</a>
                <a href="#" className="text-[11px] text-[#777777] hover:text-white transition-colors">Network Health</a>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Wallet Selection Modal */}
      <WalletModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        onSelectWallet={handleWalletSelect}
      />
    </>
  );
};

const App: React.FC = () => {
  return (
    <VaultProvider>
      <AppContent />
    </VaultProvider>
  );
};

export default App;