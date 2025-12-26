// contexts/PremiumContext.jsx - FIXED VERSION
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
  const [subscription, setSubscription] = useState({
    tier: 'free',
    is_premium: false,
    deep_dives_remaining: 0
  });
  const [loading, setLoading] = useState(false); // Start as false, not true

  const checkSubscription = async () => {
    try {
      setLoading(true);
      const data = await apiService.checkSubscription();
      
      // Normalize tier value
      const normalizedTier = String(data.tier).toLowerCase();
      const normalizedData = {
        tier: normalizedTier,
        is_premium: Boolean(data.is_premium || normalizedTier === 'pro'),
        deep_dives_remaining: parseInt(data.deep_dives_remaining) || 0
      };
      
      setSubscription(normalizedData);
      
      // Cache in localStorage
      localStorage.setItem('premium_status', JSON.stringify(normalizedData));
      
      return normalizedData;
    } catch (error) {
      console.error('Failed to check subscription:', error);
      
      // Try to load from cache
      const cached = localStorage.getItem('premium_status');
      if (cached) {
        try {
          const cachedData = JSON.parse(cached);
          setSubscription(cachedData);
          return cachedData;
        } catch (parseError) {
          console.error('Failed to parse cached subscription:', parseError);
        }
      }
      
      // Return default
      return subscription;
    } finally {
      setLoading(false);
    }
  };

  const decrementDeepDive = () => {
    setSubscription(prev => ({
      ...prev,
      deep_dives_remaining: Math.max(0, prev.deep_dives_remaining - 1)
    }));
  };

  useEffect(() => {
    // Only check subscription if user is logged in
    const userId = localStorage.getItem('user_id');
    const authToken = localStorage.getItem('auth_token');
    
    if (userId && authToken) {
      // User is logged in, check subscription
      checkSubscription();
    } else {
      // User is not logged in, just load from cache
      const cached = localStorage.getItem('premium_status');
      if (cached) {
        try {
          const cachedData = JSON.parse(cached);
          setSubscription(cachedData);
        } catch (error) {
          console.error('Failed to parse cached subscription:', error);
        }
      }
      setLoading(false); // Ensure loading is false
    }
  }, []);

  const value = {
    ...subscription,
    loading,
    checkSubscription,
    decrementDeepDive
  };

  return (
    <PremiumContext.Provider value={value}>
      {children}
    </PremiumContext.Provider>
  );
};