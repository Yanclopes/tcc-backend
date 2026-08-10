/* eslint-disable no-console */
import 'reflect-metadata';
import dataSource from '../config/data-source';
import { City } from '../modules/geo/entities/city.entity';
import { Country } from '../modules/geo/entities/country.entity';
import { State } from '../modules/geo/entities/state.entity';

const IBGE = 'https://servicodados.ibge.gov.br/api/v1/localidades';
const CHUNK = 500;

interface IbgeState {
  id: number;
  sigla: string;
  nome: string;
}
interface IbgeCity {
  id: number;
  nome: string;
  microrregiao?: { mesorregiao?: { UF?: { sigla?: string } } };
  'regiao-imediata'?: { 'regiao-intermediaria'?: { UF?: { sigla?: string } } };
}

/** Extrai a sigla da UF de um municipio do IBGE (dois formatos possiveis). */
function ufOf(city: IbgeCity): string | undefined {
  return (
    city.microrregiao?.mesorregiao?.UF?.sigla ??
    city['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla
  );
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`IBGE ${res.status} em ${url}`);
  return (await res.json()) as T;
}

async function run(): Promise<void> {
  await dataSource.initialize();
  console.log('Conectado. Carregando geografia do Brasil (IBGE)...');

  const countryRepo = dataSource.getRepository(Country);
  const stateRepo = dataSource.getRepository(State);
  const cityRepo = dataSource.getRepository(City);

  // ----- Pais -----
  let brasil = await countryRepo.findOne({ where: { name: 'Brasil' } });
  if (!brasil) brasil = await countryRepo.save(countryRepo.create({ name: 'Brasil' }));

  // ----- Estados (27 UFs) -----
  const ibgeStates = await fetchJson<IbgeState[]>(`${IBGE}/estados?orderBy=nome`);
  const stateByCode = new Map<string, State>();
  for (const s of ibgeStates) {
    let state = await stateRepo.findOne({ where: { code: s.sigla } });
    if (!state) {
      state = await stateRepo.save(
        stateRepo.create({ code: s.sigla, name: s.nome, country: brasil }),
      );
    }
    stateByCode.set(s.sigla, state);
  }
  console.log(`Estados prontos: ${stateByCode.size}.`);

  // ----- Municipios (~5570) -----
  const existingCount = await cityRepo.count();
  if (existingCount >= 5000) {
    console.log(`Ja ha ${existingCount} cidades cadastradas; pulando municipios.`);
    await dataSource.destroy();
    return;
  }

  const municipios = await fetchJson<IbgeCity[]>(`${IBGE}/municipios?orderBy=nome`);
  console.log(`IBGE retornou ${municipios.length} municipios. Inserindo...`);

  // Chave "nome|stateId" das cidades ja existentes, para pular duplicatas.
  const existing = await cityRepo.find({ relations: { state: true } });
  const seen = new Set(existing.map((c) => `${c.name}|${c.state.id}`));

  const toInsert: Array<{ name: string; state: { id: number } }> = [];
  let skipped = 0;
  for (const m of municipios) {
    const uf = ufOf(m);
    const state = uf ? stateByCode.get(uf) : undefined;
    if (!state) {
      skipped++;
      continue;
    }
    const key = `${m.nome}|${state.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    toInsert.push({ name: m.nome, state: { id: state.id } });
  }

  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    await cityRepo.insert(chunk as never);
    console.log(`  inseridas ${Math.min(i + CHUNK, toInsert.length)}/${toInsert.length}`);
  }

  const total = await cityRepo.count();
  console.log(`Geografia concluida. Cidades no banco: ${total}. Sem UF: ${skipped}.`);
  await dataSource.destroy();
}

run().catch((error) => {
  console.error('Falha na seed de geografia:', error);
  process.exit(1);
});
