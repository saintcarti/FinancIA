import axios from 'axios';
import { config } from '../config.js';
import { redis } from './redis.js';
import { logger } from './logger.js';

const TTL = {
  uf: 3600,
  ipc: 86400,
  tpm: 3600,
  dolar: 3600,
  euro: 3600,
  utm: 86400,
  entity: 86400 * 7
};

async function cached<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  const r = redis();
  const hit = await r.get(key);
  if (hit) return JSON.parse(hit) as T;
  const val = await fetcher();
  await r.setex(key, ttl, JSON.stringify(val));
  return val;
}

function cmfUrl(path: string): string {
  const cfg = config();
  const sep = path.includes('?') ? '&' : '?';
  const auth = cfg.CMF_API_KEY ? `${sep}apikey=${cfg.CMF_API_KEY}&formato=json` : `${sep}formato=json`;
  return `${cfg.CMF_BASE_URL}${path}${auth}`;
}

export async function getUF(date?: string): Promise<{ value: number; date: string }> {
  const today = date ?? new Date().toISOString().slice(0, 10);
  const [y, m, d] = today.split('-');
  return cached(`cmf:uf:${today}`, TTL.uf, async () => {
    const url = cmfUrl(`/uf/${y}/${m}/dias/${d}`);
    const res = await axios.get(url, { timeout: 8000 });
    const v = res.data?.UFs?.[0]?.Valor ?? null;
    if (!v) throw new Error('UF not available');
    return { value: parseFloat(v.replace('.', '').replace(',', '.')), date: today };
  });
}

export async function getIPC(yearMonth?: string): Promise<{ value: number; period: string }> {
  const ym = yearMonth ?? new Date().toISOString().slice(0, 7);
  const [y, m] = ym.split('-');
  return cached(`cmf:ipc:${ym}`, TTL.ipc, async () => {
    const res = await axios.get(cmfUrl(`/ipc/${y}/${m}`), { timeout: 8000 });
    const v = res.data?.IPCs?.[0]?.Valor ?? null;
    if (!v) throw new Error('IPC not available');
    return { value: parseFloat(v.replace(',', '.')), period: ym };
  });
}

export async function getTPM(): Promise<{ value: number; date: string }> {
  return cached('cmf:tpm', TTL.tpm, async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [y, m, d] = today.split('-');
    const res = await axios.get(cmfUrl(`/tpm/${y}/${m}/dias/${d}`), { timeout: 8000 });
    const v = res.data?.TPMs?.[0]?.Valor ?? null;
    if (!v) throw new Error('TPM not available');
    return { value: parseFloat(v.replace(',', '.')), date: today };
  });
}

export async function getDolar(date?: string): Promise<{ value: number; date: string }> {
  const today = date ?? new Date().toISOString().slice(0, 10);
  const [y, m, d] = today.split('-');
  return cached(`cmf:dolar:${today}`, TTL.dolar, async () => {
    const res = await axios.get(cmfUrl(`/dolar/${y}/${m}/dias/${d}`), { timeout: 8000 });
    const v = res.data?.Dolares?.[0]?.Valor ?? null;
    if (!v) throw new Error('Dolar not available');
    return { value: parseFloat(v.replace('.', '').replace(',', '.')), date: today };
  });
}

export async function getEuro(date?: string): Promise<{ value: number; date: string }> {
  const today = date ?? new Date().toISOString().slice(0, 10);
  const [y, m, d] = today.split('-');
  return cached(`cmf:euro:${today}`, TTL.euro, async () => {
    const res = await axios.get(cmfUrl(`/euro/${y}/${m}/dias/${d}`), { timeout: 8000 });
    const v = res.data?.Euros?.[0]?.Valor ?? null;
    if (!v) throw new Error('Euro not available');
    return { value: parseFloat(v.replace('.', '').replace(',', '.')), date: today };
  });
}

export async function getUTM(yearMonth?: string): Promise<{ value: number; period: string }> {
  const ym = yearMonth ?? new Date().toISOString().slice(0, 7);
  const [y, m] = ym.split('-');
  return cached(`cmf:utm:${ym}`, TTL.utm, async () => {
    const res = await axios.get(cmfUrl(`/utm/${y}/${m}`), { timeout: 8000 });
    const v = res.data?.UTMs?.[0]?.Valor ?? null;
    if (!v) throw new Error('UTM not available');
    return { value: parseFloat(v.replace('.', '').replace(',', '.')), period: ym };
  });
}

/**
 * Verifica si una entidad está supervisada por la CMF.
 * Q1: matching simple sobre lista local cacheada.
 * Q2: integración con endpoint oficial de instituciones.
 */
const SUPERVISED_FALLBACK = [
  'Banco de Chile', 'Banco Santander', 'Banco BCI', 'Banco Estado', 'Banco Itaú', 'Banco Falabella',
  'Banco Ripley', 'Scotiabank', 'Banco Security', 'Banco Internacional', 'Banco Consorcio',
  'Banco BICE', 'HSBC', 'Banco Edwards', 'Tanner Servicios Financieros',
  'Forum Servicios Financieros', 'Caja Los Andes', 'Caja Los Héroes', 'Caja 18',
  'Coopeuch', 'Coopnet', 'AFP Habitat', 'AFP Cuprum', 'AFP Provida', 'AFP Capital',
  'AFP Modelo', 'AFP Plan Vital', 'AFP Uno',
  'Falabella Financiero', 'Cencosud Scotiabank', 'CMR Falabella'
];

export async function verifyEntity(name: string): Promise<{
  supervised: boolean;
  matched_name?: string;
  source: 'local' | 'cmf_api';
}> {
  const norm = name.trim().toLowerCase();
  const match = SUPERVISED_FALLBACK.find((s) => s.toLowerCase().includes(norm) || norm.includes(s.toLowerCase()));
  if (match) return { supervised: true, matched_name: match, source: 'local' };
  return { supervised: false, source: 'local' };
}

/**
 * Tasa Máxima Convencional (TMC) — fórmula simplificada según Ley 18.010.
 * Producto: consumo, automotriz, hipotecario, etc.
 * NOTA: la TMC real depende de monto, plazo, y tasa de interés corriente publicada por CMF.
 * Implementación simplificada con tablas referenciales 2026 — para producción usar endpoint oficial.
 */
export async function getMaxConventionalRate(
  product: 'consumo' | 'linea_credito' | 'tarjeta_credito' | 'automotriz' | 'hipotecario',
  amountClp: number,
  termMonths: number
): Promise<{ tmc_annual_pct: number; reference_period: string }> {
  // Valores indicativos. Producción debe consumir tasa interés corriente CMF.
  const tmcTable: Record<string, number> = {
    consumo_low: 36.0,
    consumo_high: 23.5,
    linea_credito: 28.0,
    tarjeta_credito: 33.0,
    automotriz: 18.5,
    hipotecario: 8.5
  };
  // noUncheckedIndexedAccess hace que el indexed access devuelva number|undefined.
  // Default 30.0 cubre TODAS las ramas.
  const tmc: number =
    (product === 'consumo'
      ? amountClp <= 5_000_000
        ? tmcTable.consumo_low
        : tmcTable.consumo_high
      : tmcTable[product]) ?? 30.0;
  return {
    tmc_annual_pct: tmc,
    reference_period: new Date().toISOString().slice(0, 7)
  };
}
