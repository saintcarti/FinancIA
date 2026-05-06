import { describe, it, expect } from 'vitest';
import { passesGuardrails, applyDisclaimer, DISCLAIMER } from '../src/agents/guardrails';

describe('guardrails — edge cases', () => {
  it('blocks explicit "yo invertiría"', () => {
    expect(passesGuardrails('Yo invertiría en ese fondo').ok).toBe(false);
  });
  it('blocks "esta es la mejor opción"', () => {
    expect(passesGuardrails('Esta es la mejor opción para tu caso').ok).toBe(false);
  });
  it('allows describing options without recommending', () => {
    expect(passesGuardrails('Existen 3 fondos: A, B y C. Tú decides según tu perfil.').ok).toBe(true);
  });
  it('case-insensitive matching', () => {
    expect(passesGuardrails('TE RECOMIENDO INVERTIR ahora').ok).toBe(false);
  });
  it('allows neutral education about products', () => {
    const text =
      'El CAE es la Carga Anual Equivalente. Te permite comparar créditos. ' +
      'A CAE igual, dos créditos cuestan lo mismo aunque la tasa sea distinta.';
    expect(passesGuardrails(text).ok).toBe(true);
  });
});

describe('disclaimer idempotency', () => {
  it('appends disclaimer when missing', () => {
    const r = applyDisclaimer('Texto neutral.');
    expect(r).toContain('No constituye asesoría financiera');
  });
  it('does not duplicate disclaimer', () => {
    const already = 'Hola.\n' + DISCLAIMER;
    const r = applyDisclaimer(already);
    const occurrences = r.split('No constituye asesoría financiera').length - 1;
    expect(occurrences).toBe(1);
  });
  it('preserves trailing whitespace logic', () => {
    const r = applyDisclaimer('Texto   \n\n');
    expect(r.endsWith('certificado._')).toBe(true);
  });
});
