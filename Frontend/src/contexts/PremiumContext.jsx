import { createContext, useContext, useState, useEffect } from 'react';
import { apiService } from '../services/api';

const PremiumContext = createContext(null);

export const usePremium = () => {
  const context = useContext(PremiumContext);
  if (!context) {
    throw new Error('usePremium must be used within a PremiumProvider');
  }
  return context;
};

export const PremiumProvider = ({ children }) => {
  const [subscription, setSubscription] = useState(() => {
    // Initialize from localStorage
    const cached = localStorage.getItem('premium_status');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        console.error('Failed to parse cached subscription:', error);
      }
    }
    return {
      tier: 'free',
      is_premium: false,
      deep_dives_remaining: 0
    };
  });
  
  const [loading, setLoading] = useState(true);

  const checkSubscription = async () => {
    try {
      setLoading(true);
      const data = await apiService.checkSubscription();
      
      // SIMPLE LOGIC: Check for pro status
      const isPro = data.subscription_tier === 'pro' || 
                    data.tier === 'pro' || 
                    data.is_premium === true ||
                    data.success === true;
      
      const newSubscription = {
        tier: isPro ? 'pro' : 'free',
        is_premium: isPro,
        deep_dives_remaining: data.deep_dives_remaining || 0
      };
      
      setSubscription(newSubscription);
      localStorage.setItem('premium_status', JSON.stringify(newSubscription));
      
      return newSubscription;
    } catch (error) {
      console.error('Failed to check subscription:', error);
      return subscription;
    } finally {
      setLoading(false);
    }
  };

  const updateSubscription = (newData) => {
    console.log('Updating subscription with:', newData);
    
    const isPro = newData.subscription_tier === 'pro' || 
                  newData.tier === 'pro' || 
                  newData.is_premium === true ||
                  newData.success === true;
    
    const updated = {
      tier: isPro ? 'pro' : 'free',
      is_premium: isPro,
      deep_dives_remaining: newData.deep_dives_remaining || 5
    };
    
    console.log('Setting subscription to:', updated);
    setSubscription(updated);
    localStorage.setItem('premium_status', JSON.stringify(updated));
  };

  const decrementDeepDive = () => {
    setSubscription(prev => {
      const newRemaining = Math.max(0, prev.deep_dives_remaining - 1);
      const updated = {
        ...prev,
        deep_dives_remaining: newRemaining
      };
      localStorage.setItem('premium_status', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    checkSubscription();
  }, []);

  const value = {
    ...subscription,
    loading,
    checkSubscription,
    updateSubscription,
    decrementDeepDive
  };

  return (
    <PremiumContext.Provider value={value}>
      {children}
    </PremiumContext.Provider>
  );
};