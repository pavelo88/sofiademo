'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SuggestCorrectionsInputSchema = z.object({
  reportData: z.any().describe('The full report data object from Firestore.'),
});

export type SuggestCorrectionsInput = z.infer<typeof SuggestCorrectionsInputSchema>;

const SuggestCorrectionsOutputSchema = z.object({
  suggestions: z.string().describe('Sugerencias de corrección detalladas en lenguaje natural.'),
  fields: z.record(z.string(), z.string()).optional().describe('Un mapa de campo -> sugerencia específica para auto-completado.'),
  isProfessional: z.boolean().describe('Indica si el informe actual cumple con los estándares profesionales.'),
});

export type SuggestCorrectionsOutput = z.infer<typeof SuggestCorrectionsOutputSchema>;

export async function suggestCorrections(input: SuggestCorrectionsInput): Promise<SuggestCorrectionsOutput> {
  return suggestCorrectionsFlow(input);
}

const suggestCorrectionsPrompt = ai.definePrompt({
  name: 'suggestCorrectionsPrompt',
  input: { schema: SuggestCorrectionsInputSchema },
  output: { schema: SuggestCorrectionsOutputSchema },
  system: `Eres un ingeniero supervisor experto en mantenimiento de grupos electrógenos. 
Tu tarea es auditar informes técnicos realizados por inspectores de campo.
Debes:
1. Detectar errores de redacción o falta de profesionalismo.
2. Identificar inconsistencias técnicas (ej. horas de motor que no cuadran, falta de repuestos críticos mencionados en el diagnóstico).
3. Sugerir mejoras específicas para que el informe sea claro y formal para el cliente final.
4. Si el informe está perfecto, felicitar al inspector.
El idioma debe ser siempre español formal.`,
  prompt: `Datos del informe a auditar: 
"""
{{JSON.stringify reportData}}
"""`,
});

const suggestCorrectionsFlow = ai.defineFlow(
  {
    name: 'suggestCorrectionsFlow',
    inputSchema: SuggestCorrectionsInputSchema,
    outputSchema: SuggestCorrectionsOutputSchema,
  },
  async (input) => {
    const { output } = await suggestCorrectionsPrompt(input);
    return output!;
  }
);
