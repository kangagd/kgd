import React, { useEffect, useRef, useState } from 'react';

export default function PullToRefresh({ onRefresh, children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);

  useEffect(() => {
    const handleTouchStart = (e) => {
      if (window.scrollY === 0) {
        touchStartY.current = e.touches[0].clientY;
        touchStartX.current = e.touches[0].clientX;
      }
    };

    const handleTouchMove = (e) => {
      const touchY = e.touches[0].clientY;
      const touchX = e.touches[0].clientX;
      const deltaY = touchY - touchStartY.current;
      const deltaX = touchX - touchStartX.current;

      if (isRefreshing) return;

      // Only enable pull to refresh if at top and scrolling down vertically
      if (deltaY > 0 && window.scrollY === 0 && Math.abs(deltaX) < 30) {
        setIsPulling(true);
        setPullDistance(Math.min(deltaY * 0.5, 80));
        if (deltaY > 80) {
          if (e.cancelable) e.preventDefault();
        }
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance > 60 && !isRefreshing) {
        setIsRefreshing(true);
        if (onRefresh) {
            await onRefresh();
        }
        // If onRefresh reloads page, this won't run, which is fine.
        setIsRefreshing(false);
      } 
      
      setIsPulling(false);
      setPullDistance(0);
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, isRefreshing, onRefresh]);

  return (
    <div className="relative min-h-full">
      {isPulling && (
        <div 
          className="absolute top-0 left-0 right-0 flex justify-center items-center transition-all duration-200 z-40"
          style={{ height: `${pullDistance}px`, opacity: pullDistance / 80 }}
        >
          <div className="flex items-center gap-2 text-[#111827]">
            <svg className={`w-5 h-5 ${pullDistance > 60 ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-sm font-medium">{pullDistance > 60 ? 'Release to refresh' : 'Pull to refresh'}</span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}