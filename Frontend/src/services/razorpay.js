// /src/services/razorpay.js

/**
 * Utility for handling Razorpay script loading and initialization
 */

export const loadRazorpayScript = () => {
  return new Promise((resolve, reject) => {
    // Check if Razorpay is already loaded
    if (window.Razorpay) {
      console.log('Razorpay already loaded');
      resolve(window.Razorpay);
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      console.log('Razorpay script already loading, waiting...');
      // Wait for script to load
      const checkInterval = setInterval(() => {
        if (window.Razorpay) {
          console.log('Razorpay loaded from existing script');
          clearInterval(checkInterval);
          resolve(window.Razorpay);
        }
      }, 100);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Razorpay script loading timeout'));
      }, 10000);
      return;
    }

    console.log('Loading Razorpay script...');
    
    // Load the Razorpay script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    
    script.onload = () => {
      console.log('Razorpay script loaded successfully');
      if (window.Razorpay) {
        resolve(window.Razorpay);
      } else {
        reject(new Error('Razorpay script loaded but Razorpay object not found'));
      }
    };
    
    script.onerror = (error) => {
      console.error('Failed to load Razorpay script:', error);
      reject(new Error(`Failed to load Razorpay script. Please check your internet connection.`));
    };
    
    document.head.appendChild(script);
  });
};

/**
 * Initialize Razorpay checkout
 */
export const initRazorpayCheckout = async (options) => {
  try {
    // Load Razorpay script
    await loadRazorpayScript();
    
    // Create new Razorpay instance
    const rzp = new window.Razorpay(options);
    
    return rzp;
  } catch (error) {
    console.error('Failed to initialize Razorpay:', error);
    throw error;
  }
};