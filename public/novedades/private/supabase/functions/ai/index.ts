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
      const tipoVisita = String(context?.tipoVisita || 'AUDITORIA').toUpperCase()
      let tonoInstruccion = ''

      if (conclusion === 'APROBADO') {
        tonoInstruccion = `El lote fue APROBADO (cumple con los estándares de calidad).
⚠️ REGLA DE ORO CRÍTICA: NO inventes sugerencias, fallas ni recomendaciones de ningún tipo que el auditor NO haya escrito en su texto original. Tú no estás físicamente presente en la planta, el auditor sí. 
⚠️ PRESERVACIÓN ABSOLUTA (NO NEGOCIABLE): Si el auditor escribió sugerencias, observaciones, recomendaciones o comentarios en su texto original (incluso estando APROBADO), es ESTRICTAMENTE OBLIGATORIO que los incluyas en la respuesta final de forma redactada, pulida y técnica. Está prohibido ignorar, resumir de menos o descartar los comentarios u observaciones consignados por el auditor.
Si el auditor escribió que todo está excelente o dejó un comentario breve sin observaciones, limítate a redactarlo de forma extremadamente formal, profesional y técnica, confirmando la plena conformidad y aprobación del lote.`
      } else if (conclusion === 'RECHAZADO') {
        tonoInstruccion = `El lote fue RECHAZADO debido a fallas técnicas detectadas por el auditor.
⚠️ REGLA DE ORO CRÍTICA: NO inventes defectos, fallas ni desviaciones adicionales. Trabaja únicamente con las fallas indicadas por el auditor.
⚠️ PRESERVACIÓN ABSOLUTA (NO NEGOCIABLE): Es ESTRICTAMENTE OBLIGATORIO que incluyas cada una de las observaciones, fallas, comentarios o recomendaciones que el auditor consignó en su texto original. No omitas, descartes ni dejes por fuera ningún detalle reportado. Púlelo y redacta con un lenguaje técnico impecable, preciso y directo.`
      } else {
        tonoInstruccion = `Mejora la redacción y el vocabulario técnico de lo que escribió el auditor de forma neutral y profesional, sin inventar hechos, fallas ni recomendaciones adicionales. Asegúrate de conservar absolutamente todos los comentarios y detalles reportados por el auditor.`
      }

      prompt = `Eres un auditor senior de control de calidad en confección industrial. Tu objetivo es reescribir y refinar el texto del auditor para elevarlo a un nivel de informe técnico profesional, de retórica impecable, clara y sumamente concisa.

INFORMACIÓN DEL LOTE (úsala para contextualizar y refinar el lenguaje cuando sea relevante):
- Prenda: ${context?.prenda || 'No especificada'}
- Género: ${context?.genero || 'No especificado'}
- Tejido: ${context?.tejido || 'No especificado'}
- Proceso: ${context?.proceso || 'No especificado'}
- Tipo de Visita: ${tipoVisita}
- Conclusión de calidad: ${conclusion}
- Avance de producción: ${context?.avance || ''}%

${tonoInstruccion}

REGLAS ESTRICTAS DE REDACCIÓN (CUMPLIMIENTO OBLIGATORIO):
1. ⚠️ ENCABEZADO TÉCNICO FLUIDO (NORMA GENERAL): Tu respuesta DEBE comenzar estrictamente con una declaración formal en la primera línea en base al Tipo de Visita y la Conclusión. Debe estar redactada con una retórica sumamente clara, natural y concisa en español (evita sonar como una plantilla tosca o yuxtaponer palabras sin cohesión).
   
   Estructuras recomendadas de inicio según el Tipo de Visita:
   - Si Tipo de Visita es CONTRAMUESTRA: "Se realiza aprobación de contramuestra, [Prenda] [Género]..." (si está Aprobado) o "Se realiza revisión de contramuestra, [Prenda] [Género]..." (si está Rechazado).
   - Si Tipo de Visita es RONDA: "Se realiza ronda de calidad, [Prenda] [Género]..."
   - Si Tipo de Visita es AUDITORIA: "Se realiza auditoría a [PROCESO] aprobada, [Prenda] [Género]..." (si está Aprobado) o "Se realiza auditoría a [PROCESO] rechazada, [Prenda] [Género]..." (si está Rechazado). (⚠️ IMPORTANTE: reemplaza [PROCESO] con el Proceso real del lote, por ejemplo "confección", "terminación", etc.).
   - Si Tipo de Visita es SEGUIMIENTO: "Se realiza visita de seguimiento, [Prenda] [Género]..."
   
   ⚠️ MANEJO CONDICIONAL DEL TEJIDO:
   - SI EL TEJIDO está especificado (es decir, no es nulo, vacío ni "No especificado"), debes integrarlo de forma muy elegante y fluida en esa primera frase (ej: "...blusa dama en tejido Denim resortada..." o "...pantalón caballero en tejido de Algodón...").
   - SI EL TEJIDO NO está especificado (o dice "No especificado"), está ESTRICTAMENTE PROHIBIDO usar la palabra "tejido" o dejar marcadores vacíos; simplemente omítela de manera natural (ej: "...blusa dama resortada..." o "...pantalón caballero...").

   ⚠️ REGLA DE AVANCE DE PRODUCCIÓN (RONDA Y CONTRAMUESTRA):
   - Si el Avance de producción viene especificado (es decir, es un valor numérico diferente de vacío, cero o "0"), debes incorporarlo de forma retórica y natural dentro de la frase inicial de tu respuesta (ej: "...evidenciando un avance del ${context?.avance}% en la producción..." o "...con un avance registrado del ${context?.avance}%..."). Si es vacío, cero o "0", no menciones el avance en absoluto.

2. ⚠️ CORRECCIÓN OBLIGATORIA SEGÚN EL CONTEXTO REAL (NO NEGOCIABLE): Si el texto escrito por el auditor contiene errores, imprecisiones o términos que contradicen los datos de la base de datos suministrados en la "INFORMACIÓN DEL LOTE" (por ejemplo: si el auditor escribió "confección" pero el proceso del lote es realmente "Terminación", o si se equivocó en el género, la prenda o el tejido), DEBES corregir obligatoriamente el texto para alinearlo con los datos reales del lote. La información suministrada en la "INFORMACIÓN DEL LOTE" representa la única verdad real y no es negociable.
3. ⚠️ PRESERVACIÓN TOTAL DE HALLAZGOS Y COMENTARIOS (CUMPLIMIENTO OBLIGATORIO): Está ESTRICTAMENTE PROHIBIDO descartar, ignorar, resumir de menos o recortar las observaciones, sugerencias, recomendaciones, fallas o comentarios que el auditor haya consignado en su texto original. Absolutamente todo lo que el auditor escriba (tanto en estado APROBADO como RECHAZADO) debe ser fielmente incorporado en la respuesta final de manera redactada, profesional e integrada en prosa continua.
4. ⚠️ RETÓRICA DE ENLACE Y CONTINUIDAD COHESIVA (CUMPLIMIENTO OBLIGATORIO): Está terminantemente prohibido escribir frases fragmentadas, toscas o disjuntas que den la falsa impresión de dos ideas desconectadas (ejemplo incorrecto: "...estándares establecidos. Se sugiere realizar una revisión..."). Si el lote está conforme o aprobado, pero el auditor consignó observaciones o sugerencias, DEBES enlazarlas de forma sumamente retórica, elegante y natural utilizando conectores formales de continuidad o contraste (ejemplo correcto: "...constatando plena conformidad con los estándares establecidos; no obstante, se recomienda...", o "...conforme sin novedades, sugiriendo al taller...", o "...aprobado, haciendo la salvedad de realizar..."). Todo el informe debe fluir en prosa continua, cohesionada, profesional y técnicamente impecable.
5. ⚠️ EXPERTICIA Y JERGA TÉCNICA SEGÚN PRENDA Y PROCESO (CUMPLIMIENTO OBLIGATORIO): Debes actuar como un experto senior de la industria de la confección y terminación textil. Adapta y complementa la redacción utilizando la terminología técnica precisa y adecuada para la Prenda y el Proceso del lote suministrados en el contexto. Por ejemplo: si la Prenda es Blusa/Camisa usa términos como "sisa", "cartera", "puños", "sesgado", "perilla" o "cuello"; si es Jean/Pantalón usa "entrepierna", "pretina", "bota", "pasadores"; si el Proceso es "Confección" enfócate en el ensamble y tensiones de costuras; si es "Terminación" enfócate en "despeluzado", "planchado", "etiquetado" y acabados. Cíñete al contexto operativo real de la prenda.
6. Continúa inmediatamente en la siguiente frase en prosa continua con el cuerpo de la observación técnica refinada, siendo conciso, directo y formal.
7. ⚠️ PROHIBIDO INVENTAR: No agregues fallas, no agregues sugerencias de mejora preventivas ni inventes problemas que el auditor no haya mencionado. Limítate a reescribir técnicamente su texto original.
8. Redacta de forma que el personal de planta comprenda exactamente la situación técnica.
9. NO uses markdown, asteriscos, viñetas, negritas ni listas.
10. NO incluyas encabezados, títulos ni prefijos como "Observación:", "Hallazgo:", "Nota:" ni similares.
11. Devuelve únicamente la prosa reescrita con el formato exigido.

Texto a reescribir: ${text}`;

    } else {
      prompt = text;
    }

    // Modelo original: gemini-3.1-flash-lite
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { 
            temperature: 0.3,  // Aumentado de 0.1 a 0.3 para más creatividad con el contexto
            topP: 0.95, 
            maxOutputTokens: 384 
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
