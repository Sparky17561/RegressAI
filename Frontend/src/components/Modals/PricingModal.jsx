import { useState } from 'react';
import { apiService } from '../../services/api';
import { usePremium } from '../../contexts/PremiumContext';
import './PricingModal.css';

const PricingModal = ({ isOpen, onClose, onUpgrade }) => {
  const [loading, setLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const { checkSubscription } = usePremium();

  const plans = [
    {
      name: 'Freemium',
      price: '₹0',
      period: '/month',
      tag: 'Current Plan',
      features: [
        { text: 'Basic Analysis', included: true },
        { text: '3 test cases per run', included: true },
        { text: 'Deterministic diff', included: true },
        { text: 'Basic insights', included: true },
        { text: 'Team collaboration', included: true },
        { text: 'No deep dive', included: false },
        { text: 'No visualizations', included: false },
        { text: 'Requires your API key', included: true, note: true }
      ],
      buttonText: 'Current Plan',
      buttonDisabled: true,
      buttonVariant: 'secondary'
    },
    {
      name: 'Pro',
      price: '₹399',
      period: '/month',
      tag: 'RECOMMENDED',
      featured: true,
      features: [
        { text: 'Everything in Free', included: true },
        { text: 'Deep Dive Analysis', included: true },
        { text: 'Adversarial testing', included: true },
        { text: '10+ test cases', included: true },
        { text: 'Advanced visualizations', included: true },
        { text: 'Hallucination detection', included: true },
        { text: 'Edge case analysis', included: true },
        { text: '5 deep dives/month', included: true },
        { text: 'Uses RegressAI API', included: true, note: true, highlight: true }
      ],
      buttonText: 'Upgrade to Pro',
      buttonVariant: 'premium'
    }
  ];

  const handleUpgrade = async () => {
    try {
      setPaymentLoading(true);
      
      // Create order
      const order = await apiService.createOrder();
      
      // Initialize Razorpay
      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "RegressAI Pro",
        description: "Pro Plan – ₹399/month",
        order_id: order.order_id,
        handler: async (response) => {
          try {
            // Verify payment
            await apiService.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });
            
            alert("🎉 Payment successful! Pro unlocked.");
            await checkSubscription();
            onClose();
            if (onUpgrade) onUpgrade();
          } catch (error) {
            alert("Payment verification failed. Contact support.");
          }
        },
        theme: {
          color: "#6366f1"
        },
        modal: {
          ondismiss: () => {
            setPaymentLoading(false);
          }
        }
      };
      
      const rzp = new window.Razorpay(options);
      rzp.open();
      
    } catch (error) {
      console.error('Upgrade failed:', error);
      alert(`Failed to initiate payment: ${error.message}`);
      setPaymentLoading(false);
    }
  };

  const handleDemoUpgrade = async () => {
    try {
      setLoading(true);
      await apiService.upgradeToPro();
      
      alert("🎉 Demo upgrade successful! Pro features unlocked.");
      await checkSubscription();
      onClose();
      if (onUpgrade) onUpgrade();
    } catch (error) {
      alert(`Demo upgrade failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Choose Your Plan</h2>
          <button className="btn-icon close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="pricing-intro">
            <p className="intro-text">
              Upgrade to unlock advanced features, deeper insights, and better collaboration tools.
            </p>
          </div>

          <div className="pricing-grid">
            {plans.map((plan, index) => (
              <div 
                key={plan.name}
                className={`pricing-card ${plan.featured ? 'featured' : ''}`}
              >
                {plan.tag && (
                  <div className="plan-tag">{plan.tag}</div>
                )}
                
                <div className="plan-header">
                  <h3>{plan.name}</h3>
                  <div className="plan-price">
                    <span className="price">{plan.price}</span>
                    <span className="period">{plan.period}</span>
                  </div>
                </div>

                <ul className="plan-features">
                  {plan.features.map((feature, idx) => (
                    <li 
                      key={idx}
                      className={`feature-item ${feature.included ? 'included' : 'excluded'} ${feature.note ? 'note' : ''} ${feature.highlight ? 'highlight' : ''}`}
                    >
                      {feature.included ? (
                        <span className="feature-icon">✓</span>
                      ) : (
                        <span className="feature-icon">✗</span>
                      )}
                      <span className="feature-text">{feature.text}</span>
                    </li>
                  ))}
                </ul>

                <div className="plan-footer">
                  {plan.name === 'Pro' ? (
                    <>
                      <button
                        className={`btn ${plan.buttonVariant} ${paymentLoading ? 'loading' : ''}`}
                        onClick={handleUpgrade}
                        disabled={paymentLoading}
                      >
                        {paymentLoading ? (
                          <>
                            <div className="spinner small"></div>
                            Processing...
                          </>
                        ) : (
                          plan.buttonText
                        )}
                      </button>
                      <button
                        className="btn-link demo-upgrade"
                        onClick={handleDemoUpgrade}
                        disabled={loading}
                      >
                        {loading ? 'Processing demo...' : 'Try demo upgrade'}
                      </button>
                    </>
                  ) : (
                    <button
                      className={`btn ${plan.buttonVariant}`}
                      disabled={plan.buttonDisabled}
                    >
                      {plan.buttonText}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pricing-faq">
            <h3>Frequently Asked Questions</h3>
            <div className="faq-grid">
              <div className="faq-item">
                <h4>What payment methods do you accept?</h4>
                <p>We accept all major credit/debit cards, UPI, and net banking through Razorpay.</p>
              </div>
              <div className="faq-item">
                <h4>Can I cancel anytime?</h4>
                <p>Yes, you can cancel your subscription at any time. No lock-in contracts.</p>
              </div>
              <div className="faq-item">
                <h4>How do deep dives work?</h4>
                <p>Deep dives are advanced analysis runs. You get 5 per month, resetting monthly.</p>
              </div>
              <div className="faq-item">
                <h4>Is my data secure?</h4>
                <p>Yes, we use enterprise-grade security and never store your API keys or LLM responses.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingModal;