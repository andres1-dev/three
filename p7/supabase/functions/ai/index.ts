import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const { text, promptType, context } = await req.json()
    
    // Obtener la clave API desde las variables de entorno de Supabase
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")

    if (!GEMINI_KEY) {
      throw new Error("GEMINI_API_KEY no configurada en Supabase Edge Functions")
    }

    let prompt = ""

    if (promptType === 'CHAT_CORRECTION' || promptType === 'GENERIC_CORRECTION') {
      prompt = `Actúa como corrector técnico industrial especializado en redacción profesional. Corrige la ortografía, gramática, puntuación y estilo del siguiente texto, mejorando su claridad y coherencia sin alterar el significado original. Normaliza abreviaturas técnicas comunes cuando corresponda. Si el texto está completamente en mayúsculas, conviértelo a formato de escritura estándar utilizando mayúscula inicial al inicio de las oraciones y en nombres propios, y minúsculas en el resto del texto. Sustituye términos vulgares, ofensivos o inapropiados por equivalentes profesionales o neutrales cuando sea necesario. Mantén el contenido técnico implícito en el original y no agregues información nueva. Devuelve únicamente el texto corregido.\n\nTexto a corregir: ${text}`;
    } else if (promptType === 'CALIDAD_OBSERVATION') {
      prompt = `Eres un auditor senior de control de calidad en confección industrial. Reescribe el siguiente texto como una observación de seguimiento técnico: concisa, directa y sin ambigüedades. Usa el contexto del lote únicamente para orientar tu criterio técnico y elegir la terminología adecuada, pero no lo menciones ni lo repitas en la respuesta. Redacta de forma clara para que el personal operativo de planta o taller entienda exactamente qué se observó y qué se requiere corregir. Evita frases largas, rodeos o lenguaje administrativo innecesario. No agregues información que no esté en el texto original. No uses markdown, asteriscos, viñetas, negritas ni listas. No incluyas encabezados, títulos ni prefijos como "Observación:", "Hallazgo:", "Nota:" ni similares. Entrega únicamente el cuerpo del texto corregido en prosa continua, listo para pegar en un informe de seguimiento.

Contexto del lote (solo para tu criterio, no lo menciones):
- Prenda: ${context?.prenda || 'No especificada'}
- Género: ${context?.genero || 'No especificado'}
- Tejido: ${context?.tejido || 'No especificado'}
- Proceso: ${context?.proceso || 'No especificado'}

Texto a reescribir: ${text}`;
    } else {
      prompt = text;
    }

    // Modelo original: gemma-3n-e4b-it
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemma-3n-e4b-it:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, topP: 0.95, maxOutputTokens: 1024 }
      })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error?.message || "Error en la API de IA");
    }
    
    let improvedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().replace(/^["']|["']$/g, '') || text;
    
    // Limpieza post-procesamiento (siguiendo lógica de ui.js)
    if (promptType === 'CALIDAD_OBSERVATION') {
        improvedText = improvedText.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/^[-•]\s+/gm, '').trim();
        improvedText = improvedText.replace(/^[A-ZÁÉÍÓÚÑ][^:\n]{0,40}:\s*/i, '').trim();
    }

    return new Response(JSON.stringify({ success: true, improvedText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
