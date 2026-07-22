
import * as React from "react"

// Ajuste de breakpoints para una mejor correspondencia con los dispositivos
const DESKTOP_BREAKPOINT = 1280 // Las pantallas de escritorio comienzan en 1280px
const TABLET_BREAKPOINT = 768   // Las tabletas van de 768px a 1279px

export function useScreenSize() {
  const [screenSize, setScreenSize] = React.useState<"desktop" | "tablet" | "mobile" | undefined>(undefined)

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= DESKTOP_BREAKPOINT) {
        setScreenSize("desktop")
      } else if (window.innerWidth >= TABLET_BREAKPOINT) {
        setScreenSize("tablet")
      } else {
        setScreenSize("mobile")
      }
    }

    window.addEventListener("resize", handleResize)
    handleResize() // Establece el tamaño inicial de la pantalla

    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return screenSize
}
