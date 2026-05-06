import { describe, it, expect } from 'vitest';
import { passesGuardrails, applyDisclaimer, DISCLAIMER } from '../src/agents/guardrails';

describe('guardrails.passesGuardrails', () => {
  it('blocks investment recommendations', () => {
    expect(passesGuardrails('Te recomiendo invertir en este fondo').ok).toBe(false);
    expect(passesGuardrails('Yo compraría acciones de Falabella').ok).toBe(false);
    expect(passesGuardrails('Garantizo rentabilidad del 12%').ok).toBe(false);
  });
  it('allows educational explanations', () => {
    expect(passesGuardrails('La UF es una unidad de cuenta reajustable según IPC.').ok).toBe(true);
    expect(passesGuardrails('Un crédito de consumo a tasa X y plazo Y tendrá CAE Z.').ok).toBe(true);
  });
});

describe('guardrails.applyDisclaimer', () => {
  it('appends disclaimer when missing', () => {
    const out = applyDisclaimer('Hola, te explico la UF.');
    expect(out).toContain(DISCLAIMER.trim().slice(0, 30));
  });
  it('does not duplicate', () => {
    const already = 'Texto. ' + DISCLAIMER;
    const out = applyDisclaimer(already);
    const occurrences = out.split('No constituye asesoría financiera').length - 1;
    expect(occurrences).toBe(1);
  });
});
