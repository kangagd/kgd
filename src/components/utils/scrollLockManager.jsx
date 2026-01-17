// Scroll lock manager with reference counting to prevent breakage from nested modals
let scrollLockCount = 0;

export const lockBodyScroll = () => {
  scrollLockCount++;
  if (scrollLockCount === 1) {
    // Only apply lock on first call
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }
};

export const unlockBodyScroll = () => {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    // Only release lock when all locks are gone
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }
};

export const forceUnlockBodyScroll = () => {
  scrollLockCount = 0;
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
  document.body.classList.remove('overflow-hidden', 'modal-open');
};