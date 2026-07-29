'use server';
/**
 * @fileOverview A Genkit flow to process technical dictation.
 *
 * - processDictation - A function that processes technical dictation using AI.
 * - ProcessDictationInput - The input type for the processDictation function.
 * - ProcessDictationOutput - The return type for the processDictation function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ProcessDictationInputSchema = z.object({
  dictation: z.string().describe('El dictado técnico del inspector.'),
});
export type ProcessDictationInput = z.infer<typeof ProcessDictationInputSchema>;

const ProcessDictationOutputSchema = z.object({
  identidad: z.object({
    cliente: z.string().optional(),
    instalacion: z.string().optional(),
    direccion: z.string().optional(),
    n_grupo: z.string().optional(),
    potencia_kva: z.string().optional(),
    marca: z.string().optional(),
    modelo: z.string().optional(),
    sn: z.string().optional(),
    recibe: z.string().optional(),
  }),
  all_ok: z.boolean(),
  checklist_updates: z.record(z.string()),
  mediciones_generales: z.object({
    horas: z.string().optional(),
    presion: z.string().optional(),
    temp: z.string().optional(),
    combustible: z.string().optional(),
    tensionAlt: z.string().optional(),
    frecuencia: z.string().optional(),
    cargaBat: z.string().optional(),
  }),
  pruebas_carga: z.object({
    rs: z.string().optional(),
    st: z.string().optional(),
    rt: z.string().optional(),
    r: z.string().optional(),
    s: z.string().optional(),
    t: z.string().optional(),
    kw: z.string().optional(),
  }),
  observations_summary: z.string(),
  error: z.string().optional(),
});
export type ProcessDictationOutput = z.infer<
  typeof ProcessDictationOutputSchema
>;

export async function processDictation(
  input: ProcessDictationInput
): Promise<ProcessDictationOutput> {
  try {
    return await processDictationFlow(input);
  } catch (e: any) {
    console.error("Genkit processDictation error:", e);
    // Retornar un objeto vacío con el error para manejarlo en el cliente
    return {
      identidad: {},
      all_ok: false,
      checklist_updates: {},
      mediciones_generales: {},
      pruebas_carga: {},
      observations_summary: input.dictation, // Devolver el texto original al menos
      error: e.message || "Error desconocido en el servicio de IA"
    };
  }
}

const processDictationPrompt = ai.definePrompt({
  name: 'processDictationPrompt',
  input: {schema: ProcessDictationInputSchema},
  output: {schema: ProcessDictationOutputSchema},
  prompt: `Analiza detalladamente este dictado técnico: "{{{dictation}}}".
    
    INSTRUCCIONES DE EXTRACCIÓN SÚPER ESTRICTAS Y PRIORITARIAS:

    Tu tarea es procesar el dictado en dos pasos:
    
    PASO 1: Procesar ítems específicos.
    Busca menciones a ítems de checklist o recambios y asigna un estado según estas reglas:
    - Si el dictado dice "cambio de", "se cambiaron", "reemplazo" (ej. "cambio de filtro de aceite"), asigna el valor "CMB" al ítem en el objeto 'checklist_updates'.
    - Si dice "averiado", "roto", "defecto", (ej. "correa del ventilador averiada"), asigna "AVR" o "DEF".
    - Si dice "Filtro de aire okay", asigna "OK".
    
    PASO 2: Procesar el comando "todo lo demás OK".
    - DESPUÉS de haber procesado los ítems específicos, si el dictado contiene una frase como "el resto okay", "los demás okay", "marcar pendientes como okay", o "todos los ítems revisados están okay", entonces y solo entonces, establece el campo booleano 'all_ok' a 'true'.
    - Si no se menciona una frase genérica para el resto, 'all_ok' debe ser 'false'.
    - Este orden es crucial. Un dictado como "Cambio filtro de combustible y el resto okay" debe resultar en \`checklist_updates: {"Filtro de combustible": "CMB"}\` Y \`all_ok: true\`.
    
    Además de los ítems del checklist, extrae la siguiente información si está presente:
    
    1. IDENTIDAD: Extrae "Cliente", "Instalación", "Dirección", "Nº Grupo", "Potencia" (en KVA), "Marca", "Modelo", "SN/Serie", "Persona que recibe".
    2. MEDICIONES GENERALES: Extrae valores para "Horas", "Presión de aceite", "Temperatura", "Nivel de combustible", "Tensión del alternador", "Frecuencia", "Carga de batería".
    3. PRUEBAS CON CARGA: Extrae valores para tensiones (RS, ST, RT), intensidades (R, S, T) y potencia con carga (kW).
    4. OBSERVACIONES: Basado en TODO el dictado, redacta un informe técnico y profesional. 
    REGLAS DE FORMATO PARA OBSERVACIONES:
    - Usa títulos en MAYÚSCULAS Y NEGRITA (ej: **ANTECEDENTES**).
    - Cada título solo en su línea, con DOBLE SALTO DE LÍNEA antes y después.
    - Estructura: **ANTECEDENTES**, **INTERVENCIÓN**, **RESUMEN Y SITUACIÓN ACTUAL**.
    - Lenguaje técnico y formal.

    Devuelve estrictamente un JSON con el schema definido.`,
});

const processDictationFlow = ai.defineFlow(
  {
    name: 'processDictationFlow',
    inputSchema: ProcessDictationInputSchema,
    outputSchema: ProcessDictationOutputSchema,
  },
  async (input: z.infer<typeof ProcessDictationInputSchema>) => {
    const {output} = await processDictationPrompt(input);
    return output!;
  }
);
