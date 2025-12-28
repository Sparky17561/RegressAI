import { useState } from 'react';
import { apiService } from '../../services/api';
import { usePremium } from '../../contexts/PremiumContext';
import { loadRazorpayScript } from '../../services/razorpay';
import './PricingModal.css';

const PricingModal = ({ isOpen, onClose, onUpgrade }) => {
  const [loading, setLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const { checkSubscription, updateSubscription } = usePremium();

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
      
      console.log('Creating order...');
      
      // Create order on your backend
      const order = await apiService.createOrder();
      
      console.log('Order created:', order);
      
      // Check for order_id
      if (!order || !order.order_id) {
        console.error('Order missing order_id:', order);
        throw new Error('Failed to create order. Please try again.');
      }
      
      console.log('Loading Razorpay script...');
      
      // Load Razorpay script
      await loadRazorpayScript();
      
      if (!window.Razorpay) {
        throw new Error('Failed to load Razorpay payment gateway');
      }
      
      console.log('Initializing Razorpay checkout...');
      
      // Get user info from localStorage for prefill
      const userName = localStorage.getItem('user_name') || '';
      const userEmail = localStorage.getItem('user_email') || '';
      const userPhone = localStorage.getItem('user_phone') || '';
      
      // Initialize Razorpay
      const options = {
        key: order.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount, // Amount in paise (₹399 = 39900 paise)
        currency: order.currency || 'INR',
        name: "RegressAI",
        description: "Pro Plan – ₹399/month",
        order_id: order.order_id, // Use order_id from backend
        handler: async (response) => {
          console.log('Payment successful, verifying...', response);
          
          try {
            // Verify payment with your backend
            const verification = await apiService.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });
            
            console.log('Payment verification result:', verification);
            
            if (verification.success) {
              // Immediately update subscription state
              updateSubscription({
                tier: 'pro',
                subscription_tier: 'pro',
                is_premium: true,
                deep_dives_remaining: verification.deep_dives_remaining || 5,
                ...verification
              });
              
              alert("🎉 Payment successful! Pro features are now unlocked.");
              
              // Also refresh from server to be safe
              await checkSubscription();
              
              onClose();
              if (onUpgrade) onUpgrade();
            } else {
              alert("❌ Payment verification failed. Please contact support.");
            }
          } catch (error) {
            console.error('Payment verification error:', error);
            alert("Payment verification failed. Please contact support.");
          } finally {
            setPaymentLoading(false);
          }
        },
        prefill: {
          name: userName,
          email: userEmail,
          contact: userPhone
        },
        theme: {
          color: "#6366f1"
        },
        modal: {
          ondismiss: () => {
            console.log('Payment modal dismissed');
            setPaymentLoading(false);
          },
          escape: true,
          backdropclose: false
        },
        notes: {
          source: "regressai_web_app"
        }
      };
      
      console.log('Opening Razorpay modal with options:', options);
      
      // Open Razorpay checkout
      const rzp = new window.Razorpay(options);
      rzp.open();
      
      rzp.on('payment.failed', (response) => {
        console.error('Payment failed:', response.error);
        alert(`Payment failed: ${response.error.description || 'Please try again.'}`);
        setPaymentLoading(false);
      });
      
    } catch (error) {
      console.error('Upgrade failed:', error);
      alert(`Failed to initiate payment: ${error.message || 'Please try again.'}`);
      setPaymentLoading(false);
    }
  };

  const handleDemoUpgrade = async () => {
    try {
      setLoading(true);
      const result = await apiService.upgradeToPro();
      
      // Update subscription immediately
      updateSubscription({
        tier: 'pro',
        is_premium: true,
        deep_dives_remaining: 5,
        ...result
      });
      
      alert("🎉 Demo upgrade successful! Pro features unlocked.");
      
      // Also refresh from server
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