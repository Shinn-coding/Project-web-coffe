'use client';

import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
}

// Key by pathname so route changes remount the wrapper and replay the animation.
export default function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="flex-1 flex flex-col page-enter">
      {children}
    </div>
  );
}