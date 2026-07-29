import {
  Activity,
  Cpu,
  Droplets,
  Factory,
  FileText,
  Globe,
  Package,
  PhoneCall,
  Settings,
  ShieldCheck,
  Wrench
} from 'lucide-react';

export interface Service {
  id: string;
  title: string;
  description: string;
  desc?: string;
  fullDescription: string;
  image: string;
  icon: any; // Usaremos el componente de React directamente
}

export const services: Service[] = [
  {
    id: 'mantenimiento-integral',
    title: 'Mantenimiento Integral',
    description: 'Planes personalizados preventivos y correctivos con revisiones flexibles adaptadas a sus protocolos para asegurar la continuidad de sus equipos.',
    desc: 'Planes personalizados preventivos y correctivos con revisiones flexibles adaptadas a sus protocolos para asegurar la continuidad de sus equipos.',
    fullDescription: 'Realizamos mantenimientos preventivos y correctivos exhaustivos, incluyendo revisiones flexibles que se adaptan a las necesidades operativas de cada cliente.',
    image: "/mantenimiento.png",
    icon: Wrench
  },
  {
    id: 'inspecciones-pruebas',
    title: 'Inspecciones y Pruebas de Carga',
    description: 'Revisiones detalladas con tecnología avanzada y pruebas de banco de carga para certificar el rendimiento crítico ante cualquier fallo de red.',
    desc: 'Revisiones detalladas con tecnología avanzada y pruebas de banco de carga para certificar el rendimiento crítico ante cualquier fallo de red.',
    fullDescription: 'Evaluamos el estado electromecánico mediante diagnósticos avanzados y validamos la capacidad real de respuesta con bancos de carga certificados.',
    image: "/inspeccion.png",
    icon: ShieldCheck
  },
  {
    id: 'consumibles-fluidos',
    title: 'Consumibles y Fluidos',
    description: 'Sustitución periódica de aceite, filtros, baterías y anticongelante con productos de alta gama para prolongar la vida útil de sus motores industriales.',
    desc: 'Sustitución periódica de aceite, filtros, baterías y anticongelante con productos de alta gama para prolongar la vida útil de sus motores industriales.',
    fullDescription: 'Mantenemos sus motores en condiciones óptimas mediante la gestión integral de fluidos y recambio de componentes críticos según programas de vida útil.',
    image: "/stockl.png",
    icon: Droplets
  },
  {
    id: 'reparacion-averias',
    title: 'Reparación de Averías',
    description: 'Diagnóstico técnico preciso y resolución de fallos con tarifas transparentes y presupuestos competitivos para minimizar el tiempo de inactividad.',
    desc: 'Diagnóstico técnico preciso y resolución de fallos con tarifas transparentes y presupuestos competitivos para minimizar el tiempo de inactividad.',
    fullDescription: 'Ofrecemos soluciones inmediatas ante averías críticas, con diagnósticos precisos por inspectores cualificados y una estructura de costes clara y sin sorpresas.',
    image: "/tarifas.png",
    icon: FileText
  },
  {
    id: 'logistica-recambios',
    title: 'Logística de Recambios',
    description: 'Suministro ágil de piezas originales de las principales marcas mundiales, garantizando la disponibilidad de componentes críticos en tiempo récord.',
    desc: 'Suministro ágil de piezas originales de las principales marcas mundiales, garantizando la disponibilidad de componentes críticos en tiempo récord.',
    fullDescription: 'Nuestra red logística asegura la entrega inmediata de repuestos genuinos certificados para minimizar cualquier parada no programada de su instalación.',
    image: "/recambios.png",
    icon: Package
  },
  {
    id: 'generadores-multimarca',
    title: 'Generadores Multimarca',
    description: 'Especialistas en motores diésel y gas, sistemas estacionarios, móviles e insonorizados de marcas líderes como Perkins, Cummins y Volvo Penta.',
    desc: 'Especialistas en motores diésel y gas, sistemas estacionarios, móviles e insonorizados de marcas líderes como Perkins, Cummins y Volvo Penta.',
    fullDescription: 'Servicio técnico experto para una amplia gama de fabricantes, cubriendo sistemas manuales y automáticos con total garantía de compatibilidad y rendimiento.',
    image: "/generadores.png",
    icon: Cpu
  },
  {
    id: 'cogeneracion-om',
    title: 'Cogeneración y O&M',
    description: 'Operación y Mantenimiento especializado para plantas de cogeneración, optimizando el rendimiento electromecánico y la gestión de sistemas auxiliares.',
    desc: 'Operación y Mantenimiento especializado para plantas de cogeneración, optimizando el rendimiento electromecánico y la gestión de sistemas auxiliares.',
    fullDescription: 'Gestión integral de plantas industriales, solucionando anomalías en bombas, torres, cuadros de control y optimizando la eficiencia energética global.',
    image: "/cogeneracion.png",
    icon: Factory
  },
  {
    id: 'asistencia-24-7',
    title: 'Asistencia Técnica 24/7',
    description: 'Soporte experto disponible los 365 días del año con respuesta inmediata y cobertura total en España y Portugal para cualquier emergencia técnica.',
    desc: 'Soporte experto disponible los 365 días del año con respuesta inmediata y cobertura total en España y Portugal para cualquier emergencia técnica.',
    fullDescription: 'Disponibilidad absoluta para atender urgencias críticas a cualquier hora, garantizando la continuidad del suministro energético donde más se necesita.',
    image: "/asistencia.png",
    icon: PhoneCall
  },
  {
    id: 'modernizacion-telegestion',
    title: 'Modernización y Telegestión',
    description: 'Actualización de sistemas obsoletos e implementación de monitorización remota inteligente para el control y supervisión 24/7 de sus activos.',
    desc: 'Actualización de sistemas obsoletos e implementación de monitorización remota inteligente para el control y supervisión 24/7 de sus activos.',
    fullDescription: 'Convertimos equipos antiguos en sistemas inteligentes (Retrofitting) con control digital y supervisión remota vía telegestión de última generación.',
    image: "/modernizacion.png",
    icon: Settings
  }
];

// Datos adicionales para el header/footer y estadísticas (sin cambios)
export const brands: string[] = [
  "Perkins", "Guascor", "Cummins", "Iveco", "Ruggerini", "Volvo Penta",
  "Lombardini", "MAN", "Rolls-Royce", "MTU", "Deif", "Baudouin",
  "Atlas Copco", "Caterpillar", "Leroy-Somer", "Pramac", "Deutz",
  "Doosan", "J.L. Metric", "Generac", "Stamford", "Isuzu", "Hipower",
  "Himoinsa", "John Deere", "Kohler", "Kubota", "FPT", "Scania",
  "Socomec", "Mosa", "Yanmar", "Mecc Alte"
];

export const contactInfo = {
  address: "Quito, Ecuador",
  phones: [
    { label: "Desarrollo", name: "Pablo García", number: "+593 98 399 2549" },
    { label: "Seguridad", name: "Sofía Acosta", number: "+593 98 016 9684" }
  ],
  phone: "+593 98 399 2549",
  emails: ["contacto@softia.tech", "soporte@softia.tech"],
  mapUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d127677.83478950893!2d-78.55836854179688!3d-0.18065319999999998!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x91d59a4002427c9f%3A0x44b991e158ef516a!2sQuito!5e0!3m2!1ses!2sec",
};

export const socialLinks = {
  facebook: "#",
  instagram: "#",
  linkedin: "#"
};

export const navLinks = [
  { href: "#servicios", label: "Servicios" },
  { href: "#marcas", label: "Marcas" },
  { href: "#contacto", label: "Contacto" },
];

export const stats = [
  { val: '+12', tag: 'Años Exp.', icon: Activity },
  { val: '+200', tag: 'Equipos', icon: Settings },
  { val: '+5', tag: 'Países', icon: Globe },
  { val: '24/7', tag: 'Soporte', icon: PhoneCall },
];
