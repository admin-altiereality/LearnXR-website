import { PricingTiers } from './PricingTiers';
import type { UserSubscription } from '../types/subscription';
import { useModal } from '../contexts/AuthContext';

interface SubscriptionModalProps {
  currentSubscription: UserSubscription | null;
  onUpgrade: (planId: string) => Promise<void>;
}

const SubscriptionModal = ({ currentSubscription, onUpgrade }: SubscriptionModalProps) => {
  const { activeModal, closeModal } = useModal();
  const isOpen = activeModal === 'subscription' || activeModal === 'upgrade';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="bg-gray-900/95 backdrop-blur-md rounded-lg shadow-lg p-6 border border-gray-700/50 max-w-5xl w-full mx-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white">Upgrade Your Plan</h2>
            <p className="text-gray-400 mt-1">Choose the perfect plan for your needs</p>
          </div>
          <button
            onClick={closeModal}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Pricing Tiers */}
        <PricingTiers
          currentSubscription={currentSubscription}
          onSelectPlan={onUpgrade}
          variant="modal"
        />
      </div>
    </div>
  );
};

export default SubscriptionModal; 