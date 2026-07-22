export const CHECKLIST_SECTIONS = {
    "INSPECCION EN EL MOTOR": [
        "Nivel de lubricante", 
        "Indicador nivel refrigerante", 
        "Correa del ventilador", 
        "Filtro de combustible", 
        "Prefiltro de combustible", 
        "Filtro de aire", 
        "Filtro de aceite", 
        "Prefiltro de aceite", 
        "Filtro de aceite bypass", 
        "Filtro de agua",
        "Tubo de escape", 
        "Circuito de refrigeración", 
        "Circuito de lubricación", 
        "Baterías", 
        "Motor de arranque"
    ],
    "INSPECCION EN EL ALTERNADOR": ["Placas de los bornes", "Regulador eléctrico", "Colector", "Rodamiento", "Ventilación", "Escobillas", "Maniobra"],
    "INSPECCION EQUIPO ELECTRICO": ["Aparatos de medida", "Pilotos", "Mantenedor de baterías", "Interruptor general", "Resistencia de caldeo", "Manguitos de caldeo", "Manguitos de combustible", "Contactores", "Reles auxiliares", "Apriete bornes", "Cableado"],
    "RECAMBIOS": ["Filtro de aceite", "Filtro de combustible", "Filtro de agua", "Filtro de aire", "Prefiltro de aceite", "Prefiltro de combustible", "Filtro de aceite bypass", "Correa motor", "Aceite", "Anticongelante"]
  };
  
  export const ALL_CHECKLIST_ITEMS = Object.values(CHECKLIST_SECTIONS).flat();
  
  export const INITIAL_FORM_DATA = {
    clienteId: '',
    clienteNombre: '',
    cliente: '',
    instalacion: '',
    direccion: '',
    motor: '',
    modelo: '',
    n_motor: '',
    n_grupo: '',
    potencia: '',
    fecha_revision: new Date().toISOString().split('T')[0],
    n_inspeccion: '',
    location: null as { lat: number; lon: number } | null,
    checklist: {},
    datos_pruebas: {
      horas: '',
      presion: '',
      temperatura: '',
      nivel_combustible: '',
      tension_alternador: '',
      frecuencia: '',
      carga_baterias: ''
    },
    pruebas_carga: {
      tension_rs: '',
      tension_st: '',
      tension_rt: '',
      intensidad_r: '',
      intensidad_s: '',
      intensidad_t: '',
      potencia_kw: ''
    },
    observaciones: '',
    recibidoPor: '',
    imageUrls: [] as string[],
  };
