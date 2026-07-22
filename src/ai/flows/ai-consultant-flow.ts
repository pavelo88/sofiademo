'use server';
/**
 * @fileOverview A Genkit flow for an AI Technical Consultant.
 * Provides professional technical answers and customer support for Energy Engine.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AIConsultantInputSchema = z.object({
  query: z.string().describe('The customer query or technical question.'),
  context: z.string().optional().describe('Additional context (e.g., equipment model, previous repairs).'),
});

export type AIConsultantInput = z.infer<typeof AIConsultantInputSchema>;

const AIConsultantOutputSchema = z.object({
  answer: z.string().describe('La respuesta profesional y técnica en español.'),
  recommendations: z.array(z.string()).describe('Lista de recomendaciones o próximos pasos.'),
  urgency: z.enum(['Baja', 'Media', 'Alta', 'Crítica']).describe('Nivel de urgencia técnica de la consulta.'),
});

export type AIConsultantOutput = z.infer<typeof AIConsultantOutputSchema>;

const aiConsultantPrompt = ai.definePrompt({
  name: 'aiConsultantPrompt',
  input: {schema: AIConsultantInputSchema},
  output: {schema: AIConsultantOutputSchema},
  system: `Eres el Consultor Técnico de IA de Energy Engine, expertos en mantenimiento preventivo y correctivo de grupos electrógenos, plantas eléctricas y sistemas de respaldo de energía.
  
  Tu objetivo es:
  1. Proveer respuestas técnicas precisas, seguras y profesionales a clientes y inspectores.
  2. Actuar como un primer nivel de soporte para diagnosticar problemas comunes (presión de aceite, temperatura, fallos de arranque, etc.).
  3. Mantener siempre un tono formal, amable y experto en español.
  4. Priorizar siempre la seguridad del personal y del equipo.
  
  Si la consulta es sobre un problema crítico (incendio, fuga grave de combustible, cortocircuito evidente), marca la urgencia como 'Crítica' y recomienda apagar el equipo y llamar al servicio técnico de emergencia inmediatamente.`,
  prompt: `Consulta: """{{{query}}}"""
  Contexto adicional: """{{{context}}}"""`,
});

export async function aiConsultant(input: AIConsultantInput): Promise<AIConsultantOutput> {
  try {
    const {output} = await aiConsultantPrompt(input);
    return output!;
  } catch (e: any) {
    console.error("AIConsultant Error:", e);
    return {
      answer: "Lo siento, el servicio de consultoría técnica por IA no está disponible en este momento. Por favor, contacte directamente con un ingeniero de Energy Engine.",
      recommendations: ["Contactar soporte técnico humano.", "Revisar manual del fabricante."],
      urgency: 'Media'
    };
  }
}
