"""
Rate limiter for Gemini API calls to avoid quota exhaustion.
Place this in app/rate_limiter.py
"""
import time
from collections import deque
from typing import Optional

class APIRateLimiter:
    """
    Token bucket rate limiter for API calls.
    
    Gemini Free Tier: 5 requests/minute
    This ensures we never exceed that limit.
    """
    
    def __init__(self, max_calls: int = 4, window_seconds: int = 60):
        """
        Args:
            max_calls: Maximum calls allowed in the window (stay under 5)
            window_seconds: Time window in seconds (60 for per-minute)
        """
        self.max_calls = max_calls
        self.window = window_seconds
        self.calls = deque()
    
    def wait_if_needed(self) -> Optional[float]:
        """
        Check if we need to wait before making next call.
        Returns: seconds waited (or None if no wait needed)
        """
        now = time.time()
        
        # Remove calls outside the window
        while self.calls and now - self.calls[0] >= self.window:
            self.calls.popleft()
        
        # If at limit, wait
        if len(self.calls) >= self.max_calls:
            oldest_call = self.calls[0]
            wait_time = self.window - (now - oldest_call) + 1
            
            print(f"[Rate Limit] At capacity ({len(self.calls)}/{self.max_calls}), sleeping {wait_time:.1f}s")
            time.sleep(wait_time)
            
            # Clean up after waiting
            now = time.time()
            while self.calls and now - self.calls[0] >= self.window:
                self.calls.popleft()
            
            self.calls.append(now)
            return wait_time
        
        # Record this call
        self.calls.append(now)
        return None
    
    def get_remaining_quota(self) -> int:
        """Get remaining calls available in current window."""
        now = time.time()
        # Clean old calls
        while self.calls and now - self.calls[0] >= self.window:
            self.calls.popleft()
        return self.max_calls - len(self.calls)


# Global instance (singleton pattern)
_gemini_limiter = APIRateLimiter(max_calls=4, window_seconds=60)

def wait_for_gemini_quota():
    """
    Call this before every Gemini API request.
    Will block if necessary to respect rate limits.
    """
    return _gemini_limiter.wait_if_needed()

def get_gemini_quota_remaining() -> int:
    """Check how many calls are available in current window."""
    return _gemini_limiter.get_remaining_quota()