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
      // Determinar el tono según la conclusión
      const conclusion = context?.conclusion || 'NO_ESPECIFICADA'
      let tonoInstruccion = ''

      if (conclusion === 'APROBADO') {
        tonoInstruccion = `El lote fue APROBADO con observaciones. Usa un tono CONSTRUCTIVO y PREVENTIVO. Enfócate en sugerencias de mejora para evitar futuras recurrencias. Las observaciones deben redactarse como oportunidades de mejora, no como fallas críticas. Usa frases como "Se sugiere", "Se recomienda", "Optimizar", "Mejorar", "Ajustar".`
      } else if (conclusion === 'RECHAZADO') {
        tonoInstruccion = `El lote fue RECHAZADO. Usa un tono ENFÁTICO y TÉCNICO. Señala claramente la gravedad del defecto, por qué incumple los estándares de calidad, y qué acción correctiva inmediata se requiere. Usa palabras clave como "Incumple", "No conforme", "Defecto crítico", "Requiere reprocesamiento", "Rechazado por". El mensaje debe transmitir urgencia y obligatoriedad de corrección.`
      } else {
        tonoInstruccion = `No se especificó conclusión. Redacta de forma neutral pero técnica, señalando los hallazgos sin determinar aprobación o rechazo.`
      }

      prompt = `Eres un auditor senior de control de calidad en confección industrial. Reescribe el siguiente texto como una observación de seguimiento técnico: concisa, directa y sin ambigüedades.

INFORMACIÓN DEL LOTE (usa esta información para contextualizar y enriquecer tu respuesta cuando sea relevante):
- Prenda: ${context?.prenda || 'No especificada'}
- Género: ${context?.genero || 'No especificado'}
- Tejido: ${context?.tejido || 'No especificado'}
- Proceso: ${context?.proceso || 'No especificado'}
- Conclusión de calidad: ${conclusion}

${tonoInstruccion}

REGLAS DE REDACCIÓN:
1. Sé conciso, directo y sin ambigüedades
2. INTEGRA el contexto técnico cuando sea relevante (por ejemplo: "En el proceso de ${context?.proceso || 'producción'}, se observa que...")
3. Redacta para que el personal operativo de planta/taller entienda exactamente qué se observó y qué se requiere corregir
4. Evita frases largas, rodeos o lenguaje administrativo innecesario
5. Puedes agregar detalles técnicos específicos basados en el tipo de prenda, tejido o proceso cuando mejore la claridad
6. NO uses markdown, asteriscos, viñetas, negritas ni listas
7. NO incluyas encabezados, títulos ni prefijos como "Observación:", "Hallazgo:", "Nota:", "Conclusión:" ni similares
8. Entrega únicamente el cuerpo del texto corregido en prosa continua, listo para pegar en un informe de seguimiento

${conclusion === 'RECHAZADO' 
  ? 'REQUISITO ADICIONAL: La respuesta DEBE reflejar la gravedad del rechazo usando terminología como "incumple", "no conforme", "crítico", "rechazado" o "requiere corrección inmediata". Menciona específicamente qué aspecto del proceso o producto no cumple con los estándares.' 
  : ''}

${conclusion === 'APROBADO' 
  ? 'REQUISITO ADICIONAL: La respuesta DEBE tener un tono constructivo, usando términos como "sugerencia", "recomendación", "mejora", "optimización" o "ajuste preventivo". Enfócate en cómo prevenir recurrencias futuras.' 
  : ''}

Texto a reescribir: ${text}`;

    } else {
      prompt = text;
    }

    // Modelo original: gemma-3n-e4b-it
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemma-3n-e4b-it:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { 
            temperature: 0.3,  // Aumentado de 0.1 a 0.3 para más creatividad con el contexto
            topP: 0.95, 
            maxOutputTokens: 1024 
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Error en la API de IA");
    }

    let improvedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().replace(/^["']|["']$/g, '') || text;

    // Limpieza post-procesamiento
    if (promptType === 'CALIDAD_OBSERVATION') {
      improvedText = improvedText
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/^[-•]\s+/gm, '')
        .trim();

      improvedText = improvedText.replace(/^[A-ZÁÉÍÓÚÑ][^:\n]{0,40}:\s*/i, '').trim();

      // Validación de coherencia con la conclusión
      const conclusion = context?.conclusion;
      if (conclusion === 'RECHAZADO') {
        const palabrasRechazo = /(incumple|no conforme|crítico|rechazado|reprocesar|defecto grave|no aceptable|fuera de especificación)/i;
        if (!palabrasRechazo.test(improvedText)) {
          console.warn("⚠️ La IA generó texto sin reflejar el estado RECHAZADO");
        }
      } else if (conclusion === 'APROBADO') {
        const palabrasAprobado = /(sugerencia|recomendación|mejora|optimización|ajuste|preventivo|podría mejorar|se sugiere)/i;
        if (!palabrasAprobado.test(improvedText) && improvedText.length > 10) {
          console.warn("⚠️ La IA generó texto sin tono constructivo para APROBADO");
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, improvedText }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    )
  }
})
