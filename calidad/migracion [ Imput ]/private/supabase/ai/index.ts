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
      prompt = `Actúa como corrector técnico industrial especializado en redacción profesional. Corrige la ortografía, gramática, puntuación y estilo del siguiente texto, mejorando su claridad y coherencia sin alterar el significado original. Normaliza abreviaturas técnicas comunes cuando corresponda. Si el texto está completamente en mayúsculas, conviértelo a formato de escritura estándar utilizando mayúscula inicial al inicio de las oraciones y en nombres propios, y minúsculas en el resto del texto. Sustituye términos vulgares, ofensivos o inapropiados por equivalentes profesionales o neutrales cuando sea necesario. Mantén el contenido técnico implícito en el original y no agregues información nueva. Devuelve únicamente el texto corregido.

Texto a corregir: ${text}`;

    } else if (promptType === 'CALIDAD_OBSERVATION') {
      prompt = `Actúa como corrector y editor técnico senior de control de calidad en confección industrial. Corrige de forma rápida y concisa la ortografía, gramática, puntuación y redacción profesional del siguiente texto. Mantén la estructura y significado original del auditor de calidad. Devuelve únicamente la prosa corregida, sin títulos, markdown, prefijos, viñetas ni comentarios adicionales.

Texto a corregir: ${text}`;

    } else {
      prompt = text;
    }

    // Modelo original: gemma-3n-e4b-it
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            topP: 0.95,
            maxOutputTokens: 384
          }
        })
      }
    )

    const result = await response.json()
    const improvedText = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || text

    return new Response(
      JSON.stringify({ success: true, improvedText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
