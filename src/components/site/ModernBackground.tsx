'use client';

/* eslint-disable react-hooks/set-state-in-effect -- QA: warning reviewed; keeping current flow to avoid behavioral changes. */

import { useTheme } from 'next-themes';
import React from 'react';

const ModernBackground = () => {
  const [mounted, setMounted] = React.useState(false);
  const { theme, systemTheme } = useTheme();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = theme === 'system' ? systemTheme : theme;
  const isDark = currentTheme === 'dark';

  if (!mounted) return null;

  return null;
};

export default ModernBackground;