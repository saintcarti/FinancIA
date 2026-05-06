/** Guardrails post-generación. */

const BLOCKED = [
  /te recomiendo (invertir|comprar|vender|tomar|elegir)/i,
  /deberías (invertir|comprar|vender|elegir|tomar)/i,
  /esta es la mejor (opción|inversión|tasa|alternativa)/i,
  /yo (compraría|invertiría|vendería|elegiría|tomaría)/i,
  /garantizo (rentabilidad|ganancia|retorno|éxito)/i,
  /vas a ganar \$|ganarás \$/i,
  /esta acción va a subir|esta acción va a bajar/i
];

export function passesGuardrails(text: string): { ok: boolean; reason?: string } {
  for (const re of BLOCKED) {
    if (re.test(text)) return { ok: false, reason: `blocked_pattern: ${re}` };
  }
  return { ok: true };
}

export const DISCLAIMER =
  '\n\n📌 _Esto es información educativa basada en datos públicos de la CMF. ' +
  'No constituye asesoría financiera personalizada ni recomendación de inversión. ' +
  'Para decisiones consulta a un asesor certificado._';

/** Aplica disclaimer al final si no está ya. */
export function applyDisclaimer(text: string): string {
  if (text.includes('No constituye asesoría financiera')) return text;
  return text.trimEnd() + DISCLAIMER;
}
