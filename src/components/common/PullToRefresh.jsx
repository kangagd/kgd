import React, { useEffect, useRef, useState } from "react";

export default function PullToRefresh({ onRefresh, children }) {
  const containerRef = useRef(null);

  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refs to avoid stale closures + avoid re-binding listeners
  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const isPullingRef = useRef(false);

  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const activeTouch = useRef(false);

  const setPull = (val) => {
    pullDistanceRef.current = val;
    setPullDistance(val);
  };

  const setPulling = (val) => {
    isPullingRef.current = val;
    setIsPulling(val);
  };

  const setRefreshing = (val) => {
    isRefreshingRef.current = val;
    setIsRefreshing(val);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const atTop = () => (el.scrollTop || 0) <= 0;

    const onTouchStart = (e) => {
      if (isRefreshingRef.current) return;
      if (!atTop()) return;

      // only track single-finger drags
      if (!e.touches || e.touches.length !== 1) return;

      activeTouch.current = true;
      touchStartY.current = e.touches[0].clientY;
      touchStartX.current = e.touches[0].clientX;
    };

    const onTouchMove = (e) => {
      if (!activeTouch.current) return;
      if (isRefreshingRef.current) return;

      if (!e.touches || e.touches.length !== 1) return;

      const touchY = e.touches[0].clientY;
      const touchX = e.touches[0].clientX;

      const deltaY = touchY - touchStartY.current;
      const deltaX = touchX - touchStartX.current;

      // must still be at top
      if (!atTop()) {
        setPulling(false);
        setPull(0);
        return;
      }

      // vertical downward pull only, ignore horizontal swipes
      if (deltaY > 0 && Math.abs(deltaX) < 30) {
        setPulling(true);

        const next = Math.min(deltaY * 0.5, 80);
        setPull(next);

        // prevent native overscroll / iOS pull-to-refresh
        if (e.cancelable) e.preventDefault();
      }
    };

    const onTouchEnd = async () => {
      activeTouch.current = false;

      const currentPull = pullDistanceRef.current;

      if (currentPull > 60 && !isRefreshingRef.current) {
        setRefreshing(true);
        try {
          await onRefresh?.();
        } finally {
          setRefreshing(false);
        }
      }

      setPulling(false);
      setPull(0);
    };

    // Important: touchmove must be non-passive to allow preventDefault
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [onRefresh]);

  return (
    <div
      ref={containerRef}
      className="relative min-h-full overflow-auto"
      style={{
        WebkitOverflowScrolling: "touch",
        overscrollBehavior: "contain",
      }}
    >
      {isPulling && (
        <div
          className="sticky top-0 left-0 right-0 flex justify-center items-center transition-all duration-200 z-40"
          style={{ height: `${pullDistance}px`, opacity: pullDistance / 80 }}
        >
          <div className="flex items-center gap-2 text-[#111827]">
            <svg
              className={`w-5 h-5 ${pullDistance > 60 ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span className="text-sm font-medium">
              {pullDistance > 60 ? "Release to refresh" : "Pull to refresh"}
            </span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
