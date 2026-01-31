import React from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';

interface OnboardingTourProps {
  run: boolean;
  onFinish: () => void;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ run, onFinish }) => {
  const steps: Step[] = [
    {
      target: 'body',
      placement: 'center',
      content: (
        <div className="text-left">
          <h3 className="text-lg font-bold mb-2">Welcome to Vault-007 🕵️‍♂️</h3>
          <p className="text-sm text-gray-600">
            The world's first fully confidential yield vault on Solana. 
            Math happens on encrypted data using FHE (Fully Homomorphic Encryption).
          </p>
        </div>
      ),
      disableBeacon: true,
    },
    {
      target: '#hero',
      content: (
        <div className="text-left">
          <h3 className="font-bold mb-1">Confidential Protocol</h3>
          <p className="text-sm text-gray-600">
            Vault-007 keeps your financial activity 100% private. 
            No one can see your deposits, transfers, or balance.
          </p>
        </div>
      ),
    },
    {
      target: '#terminal',
      content: (
        <div className="text-left">
          <h3 className="font-bold mb-1">Your Private Terminal</h3>
          <p className="text-sm text-gray-600">
            This is where you manage your funds. Everything here is encrypted by default.
          </p>
        </div>
      ),
    },
    {
      target: '.lg\\:col-span-4', // Sidebar
      content: (
        <div className="text-left">
          <h3 className="font-bold mb-1">Operations Suite</h3>
          <p className="text-sm text-gray-600">
            Deposit, Withdraw, and Transfer funds here. 
            Amounts are encrypted in your browser before they ever touch the blockchain.
          </p>
        </div>
      ),
    },
    {
      target: 'button:contains("Decrypt & Reveal")',
      content: (
        <div className="text-left">
          <h3 className="font-bold mb-1">Attested Reveal</h3>
          <p className="text-sm text-gray-600">
            Only YOU can see your balance. Click this to sign a message and 
            securely decrypt your position in your browser.
          </p>
        </div>
      ),
    },
    {
      target: '#features',
      content: (
        <div className="text-left">
          <h3 className="font-bold mb-1">Stealth Notes</h3>
          <p className="text-sm text-gray-600">
            Check out Stealth Notes below to send funds using secret passphrases 
            instead of public addresses. Total anonymity.
          </p>
        </div>
      ),
    },
  ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      onFinish();
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: '#10b981', // emerald-500
          backgroundColor: '#ffffff',
          textColor: '#111827',
          zIndex: 1000,
        },
        tooltipContainer: {
          textAlign: 'left',
        },
        buttonNext: {
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        },
        buttonBack: {
          fontSize: '12px',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginRight: '10px',
        },
        buttonSkip: {
          fontSize: '12px',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: '#6b7280',
        },
      }}
    />
  );
};

export default OnboardingTour;
