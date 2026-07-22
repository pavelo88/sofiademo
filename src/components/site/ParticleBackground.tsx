'use client';

import { useTheme } from 'next-themes';
import { useCallback, useMemo } from 'react';
import Particles from 'react-tsparticles';
import { loadFull } from 'tsparticles';
import type { Engine } from 'tsparticles-engine';

const ParticleBackground = () => {
  const { theme, systemTheme } = useTheme();

  const particlesInit = useCallback(async (engine: Engine) => {
    await loadFull(engine);
  }, []);

  const currentTheme = theme === 'system' ? systemTheme : theme;

  const particleOptions = useMemo(() => {
    // Debounce/Stable values for colors
    const particleColor = currentTheme === 'dark' ? '#ffffff' : '#555555';
    const linkColor = currentTheme === 'dark' ? '#ffffff' : '#555555';

    return {
      autoPlay: true,
      fullScreen: { enable: true, zIndex: -1 },
      background: {
        color: {
          value: 'transparent',
        },
      },
      fpsLimit: 30, // Reducir FPS para ahorrar recursos y reducir updates
      interactivity: {
        events: {
          onHover: {
            enable: true,
            mode: 'grab',
          },
          resize: true,
        },
        modes: {
          grab: {
            distance: 140,
            links: {
              opacity: 1,
            },
          },
        },
      },
      particles: {
        color: {
          value: particleColor,
        },
        links: {
          color: linkColor,
          distance: 150,
          enable: true,
          opacity: 0.1,
          width: 0.5,
        },
        move: {
          direction: 'none' as const,
          enable: true,
          outModes: {
            default: 'bounce' as const,
          },
          random: false,
          speed: 0.5,
          straight: false,
        },
        number: {
          density: {
            enable: true,
            area: 800,
          },
          value: 30, // Reducir cantidad para estabilidad
        },
        opacity: {
          value: 0.2,
        },
        shape: {
          type: 'triangle' as const,
        },
        size: {
          value: { min: 1, max: 3 },
        },
      },
      detectRetina: false, // Desactivar detección de retina para evitar re-calculos
    };
  }, [currentTheme]); // Solo re-memoizar si cambia el modo real

  return (
    <Particles
      id="tsparticles"
      init={particlesInit}
      options={particleOptions}
    />
  );
};

export default ParticleBackground;
