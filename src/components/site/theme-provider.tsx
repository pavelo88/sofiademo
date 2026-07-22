"use client"

import type { ThemeProviderProps } from "next-themes"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { usePathname } from "next/navigation"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const pathname = usePathname()
  
  // Comentado: el modo claro no se utilizará por el momento
  // const isForcedLightRoute = pathname?.startsWith('/auth') || 
  //                            pathname?.startsWith('/admin') || 
  //                            pathname?.startsWith('/inspection');
  
  const isForcedDarkRoute = pathname?.startsWith('/auth') || pathname?.startsWith('/admin');
  const isForcedLightInspection = pathname?.startsWith('/inspection');

  return (
    <NextThemesProvider 
      {...props} 
      forcedTheme={isForcedDarkRoute ? 'dark' : (isForcedLightInspection ? 'light' : undefined)}
    >
      {children}
    </NextThemesProvider>
  )
}