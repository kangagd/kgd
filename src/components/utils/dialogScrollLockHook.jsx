import { useEffect } from 'react';
import { lockBodyScroll, unlockBodyScroll } from './scrollLockManager';

/**
 * Hook to handle body scroll locking/unlocking when dialog/sheet is open
 * Call this inside Dialog/Sheet components that are open
 */
export const useDialogScrollLock = (isOpen) => {
  useEffect(() => {
    if (isOpen) {
      lockBodyScroll();
      return () => unlockBodyScroll();
    }
  }, [isOpen]);
};