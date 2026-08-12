#!/usr/bin/env node
// Robô de sincronização Petbee → Twenty CRM.
//
// Lê o MySQL da Petbee (humans, pets, pets_humans, plans, subscriptions) e
// espelha no Twenty via API, ancorado nos campos "ID Petbee" — idempotente:
// cria o que falta, atualiza o que mudou, nunca duplica.
//
// Modos:
//   node sync-petbee-crm.mjs --full     # primeira carga / recarga (cria o que falta)
//   node sync-petbee-crm.mjs            # incremental: só o que mudou desde a última rodada
//
// Config via variáveis de ambiente (arquivo .env ao lado, carregado sozinho):
//   PETBEE_MYSQL_URL=mysql://usuario:senha@host:3306/petbee
//   TWENTY_API_URL=https://crm.petbeetools.com.br
//   TWENTY_API_KEY=...
//
// O cursor incremental fica em ./sync-cursor.txt (com 1h de sobreposição de
// segurança — reprocessar um registro é inofensivo, upsert é idempotente).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import mysql from 'mysql2/promise';

const HERE = dirname(fileURLToPath(import.meta.url));

// .env simples (chave=valor), sem depender de biblioteca
if (existsSync(join(HERE, '.env'))) {
  for (const line of readFileSync(join(HERE, '.env'), 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const MYSQL_URL = process.env.PETBEE_MYSQL_URL;
const API_URL = (process.env.TWENTY_API_URL ?? '').replace(/\/+$/, '');
const API_KEY = process.env.TWENTY_API_KEY;
const FULL = process.argv.includes('--full');
const CURSOR_FILE = join(HERE, 'sync-cursor.txt');
const BATCH = 60;

if (!MYSQL_URL || !API_URL || !API_KEY) {
  console.error('Config faltando: defina PETBEE_MYSQL_URL, TWENTY_API_URL e TWENTY_API_KEY (arquivo .env).');
  process.exit(1);
}

const gql = async (query, variables = {}) => {
  const response = await fetch(`${API_URL}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.text();
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error(`Resposta inesperada (HTTP ${response.status}): ${body.slice(0, 200)}`);
  }
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join(' | '));
  return json.data;
};

// Mapa anchor→uuid de um objeto do CRM, paginando
const fetchAnchorMap = async (plural, anchorField) => {
  const map = new Map();
  let after = null;
  for (;;) {
    const data = await gql(
      `query P($after: String) { ${plural}(first: 500, after: $after) {
        pageInfo { hasNextPage endCursor }
        edges { node { id ${anchorField} } } } }`,
      { after },
    );
    for (const { node } of data[plural].edges) {
      if (node[anchorField]) map.set(String(node[anchorField]), node.id);
    }
    if (!data[plural].pageInfo.hasNextPage) break;
    after = data[plural].pageInfo.endCursor;
  }
  return map;
};

const chunk = (list, size) => {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

// Cria em lote os que não existem, adota por e-mail leads sem ID Petbee e
// atualiza um a um os que mudaram
const upsertAll = async ({ label, singular, createMany, anchorField, rows, changedIds, anchorMap, adoptByEmail, emailOf }) => {
  const cap = singular.charAt(0).toUpperCase() + singular.slice(1);
  const toCreate = [];
  const toUpdate = [];
  const toAdopt = [];

  for (const row of rows) {
    if (anchorMap.has(row[anchorField])) {
      if (!FULL && changedIds.has(row[anchorField])) toUpdate.push(row);
      continue;
    }
    // lead cadastrado antes de virar cliente: mesmo e-mail, sem ID Petbee →
    // atualiza o registro existente e carimba o ID (nunca duplica)
    const email = adoptByEmail && emailOf ? (emailOf(row) || '').toLowerCase() : '';
    const leadId = email ? adoptByEmail.get(email) : undefined;
    if (leadId) {
      toAdopt.push([leadId, row, email]);
    } else {
      toCreate.push(row);
    }
  }

  for (const [leadId, row, email] of toAdopt) {
    await gql(
      `mutation A($id: UUID!, $data: ${cap}UpdateInput!) { update${cap}(id: $id, data: $data) { id } }`,
      { id: leadId, data: row },
    );
    anchorMap.set(row[anchorField], leadId);
    adoptByEmail.delete(email);
  }

  for (const batch of chunk(toCreate, BATCH)) {
    const data = await gql(
      `mutation C($data: [${cap}CreateInput!]!) { ${createMany}(data: $data) { id ${anchorField} } }`,
      { data: batch },
    );
    for (const node of data[createMany]) anchorMap.set(String(node[anchorField]), node.id);
  }

  for (const row of toUpdate) {
    await gql(
      `mutation U($id: UUID!, $data: ${cap}UpdateInput!) { update${cap}(id: $id, data: $data) { id } }`,
      { id: anchorMap.get(row[anchorField]), data: row },
    );
  }

  const untouched = rows.length - toCreate.length - toUpdate.length - toAdopt.length;
  console.log(
    `${label}: +${toCreate.length} criados` +
      (toAdopt.length ? `, ↷${toAdopt.length} adotados (lead existente por e-mail)` : '') +
      `, ~${toUpdate.length} atualizados, ${untouched} sem mudança`,
  );
};

const datePart = (value) => {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date) ? undefined : date.toISOString().slice(0, 10);
};
const centsToMicros = (cents) => Math.round(Number(cents || 0)) * 10000;
const parsePhone = (phone) => {
  if (!phone) return undefined;
  const digits = String(phone).replace(/[^\d+]/g, '');
  const national = digits.startsWith('+55') ? digits.slice(3) : digits.replace(/^\+/, '');
  return { primaryPhoneCallingCode: '+55', primaryPhoneCountryCode: 'BR', primaryPhoneNumber: national };
};
const splitName = (fullName) => {
  const parts = String(fullName || '').trim().split(/\s+/);
  return { firstName: parts[0] || '?', lastName: parts.slice(1).join(' ') || '' };
};

const run = async () => {
  const startedAt = new Date();
  // sobreposição de 1h para nunca perder nada entre rodadas
  const cursor = !FULL && existsSync(CURSOR_FILE)
    ? new Date(new Date(readFileSync(CURSOR_FILE, 'utf8').trim()).getTime() - 3600_000)
    : new Date(0);

  console.log(`[${startedAt.toISOString()}] Sync ${FULL ? 'FULL' : `incremental desde ${cursor.toISOString()}`}`);

  // RDS exige SSL; usa o CA da Amazon se baixado pelo install-cron.sh.
  // Via túnel (127.0.0.1) o certificado é do host real do RDS, então a
  // checagem de hostname é dispensada — a cadeia continua validada pelo CA.
  const caPath = join(HERE, 'rds-global-bundle.pem');
  const viaTunnel = /@(127\.0\.0\.1|localhost)[:/]/.test(MYSQL_URL);
  const ssl = existsSync(caPath)
    ? { ca: readFileSync(caPath), ...(viaTunnel ? { checkServerIdentity: () => undefined } : {}) }
    : { rejectUnauthorized: false };
  const db = await mysql.createConnection({ uri: MYSQL_URL, ssl });

  const [plans] = await db.query('SELECT id, name, value, blocked, updated_at FROM plans WHERE deleted_at IS NULL');
  const [humans] = await db.query(
    `SELECT id, full_name, email, phone,
            CASE WHEN document_type = 'cpf' THEN document END AS cpf, updated_at, created_at
     FROM humans WHERE deleted_at IS NULL`,
  );
  const [pets] = await db.query(
    `SELECT p.id, p.name, p.gender, p.breed, p.birthday, f.name AS especie, p.updated_at, p.created_at
     FROM pets p LEFT JOIN pet_families f ON f.id = p.family_id
     WHERE p.deleted_at IS NULL`,
  );
  const [links] = await db.query(
    'SELECT pet_id, human_id FROM pets_humans WHERE deleted_at IS NULL ORDER BY created_at ASC',
  );
  const [subs] = await db.query(
    `SELECT id, plan_id, pet_id, human_id, coupon, amount, frequency, start_date, canceled_at,
            blocked, finished, next_recurrency, updated_at, created_at
     FROM subscriptions WHERE deleted_at IS NULL`,
  );
  await db.end();

  console.log(`MySQL: ${plans.length} planos, ${humans.length} tutores, ${pets.length} pets, ${subs.length} assinaturas`);

  // tutor principal do pet: quem paga a assinatura mais recente; senão o vínculo mais antigo
  const petTutor = new Map();
  for (const link of links) if (!petTutor.has(link.pet_id)) petTutor.set(link.pet_id, link.human_id);
  for (const sub of subs) petTutor.set(sub.pet_id, sub.human_id);

  // Dedup na entrada: a origem tem pets clonados (mesmo tutor + nome +
  // espécie + sexo, ex.: 9 "Apollo" idênticos). Importa só o melhor
  // representante de cada grupo (tem assinatura > mais recente); assinaturas
  // que apontem para um clone são religadas ao representante. Pets sem tutor
  // não são agrupados (não dá para afirmar que são o mesmo animal).
  const petsWithSub = new Set(subs.map((s) => s.pet_id));
  const petsWithActiveSub = new Set(
    subs.filter((s) => !s.canceled_at && !s.finished && !s.blocked).map((s) => s.pet_id),
  );
  const cloneKey = (p) =>
    petTutor.has(p.id)
      ? `${petTutor.get(p.id)}|${String(p.name || '').trim().toLowerCase()}|${p.especie ?? ''}|${p.gender ?? ''}`
      : `solo-${p.id}`;
  // prioridade: assinatura ATIVA > alguma assinatura (mesmo cancelada) > mais recente
  const cloneScore = (p) =>
    (petsWithActiveSub.has(p.id) ? 2e15 : petsWithSub.has(p.id) ? 1e15 : 0) +
    new Date(p.updated_at || p.created_at || 0).getTime();
  const representative = new Map();
  for (const p of pets) {
    const key = cloneKey(p);
    const current = representative.get(key);
    if (!current || cloneScore(p) > cloneScore(current)) representative.set(key, p);
  }
  const petIdRemap = new Map(pets.map((p) => [p.id, representative.get(cloneKey(p)).id]));
  const dedupedPets = [...representative.values()];
  if (dedupedPets.length < pets.length) {
    console.log(`Dedup de pets na origem: ${pets.length - dedupedPets.length} clones ignorados`);
  }

  const activeHumans = new Set(
    subs.filter((s) => !s.canceled_at && !s.finished && !s.blocked).map((s) => s.human_id),
  );
  const subStatus = (s) => (s.canceled_at || s.finished ? 'CANCELADA' : s.blocked ? 'BLOQUEADA' : 'ATIVA');
  const changed = (row) =>
    new Date(row.updated_at || row.created_at || 0) >= cursor || new Date(row.created_at || 0) >= cursor;

  console.log('Lendo âncoras existentes no CRM…');
  // Pessoas: além do ID Petbee, mapeia e-mails dos registros SEM ID (leads
  // criados antes do cadastro no app — candidatos a adoção)
  const personMap = new Map();
  const leadsByEmail = new Map();
  {
    let after = null;
    for (;;) {
      const data = await gql(
        `query P($after: String) { people(first: 500, after: $after) {
          pageInfo { hasNextPage endCursor }
          edges { node { id hIdPetbee emails { primaryEmail } } } } }`,
        { after },
      );
      for (const { node } of data.people.edges) {
        if (node.hIdPetbee) personMap.set(String(node.hIdPetbee), node.id);
        else if (node.emails?.primaryEmail) leadsByEmail.set(node.emails.primaryEmail.toLowerCase(), node.id);
      }
      if (!data.people.pageInfo.hasNextPage) break;
      after = data.people.pageInfo.endCursor;
    }
  }
  const [planMap, petMap, subMap] = await Promise.all([
    fetchAnchorMap('planos', 'planIdPetbee'),
    fetchAnchorMap('petss', 'petIdPetbee'),
    fetchAnchorMap('assinaturas', 'subsIdPetbee'),
  ]);

  await upsertAll({
    label: 'Planos', singular: 'Plano', createMany: 'createPlanos', anchorField: 'planIdPetbee',
    anchorMap: planMap,
    changedIds: new Set(plans.filter(changed).map((p) => String(p.id))),
    rows: plans.map((p) => ({
      planIdPetbee: String(p.id),
      name: p.name,
      valorMensal: { amountMicros: centsToMicros(p.value), currencyCode: 'BRL' },
      ativo: !p.blocked,
    })),
  });

  await upsertAll({
    label: 'Tutores', singular: 'Person', createMany: 'createPeople', anchorField: 'hIdPetbee',
    anchorMap: personMap,
    adoptByEmail: leadsByEmail,
    emailOf: (row) => row.emails?.primaryEmail,
    changedIds: new Set(humans.filter(changed).map((h) => String(h.id))),
    rows: humans.map((h) => ({
      hIdPetbee: String(h.id),
      name: splitName(h.full_name),
      emails: h.email ? { primaryEmail: h.email } : undefined,
      phones: parsePhone(h.phone),
      cpf: h.cpf || undefined,
      statusCliente: activeHumans.has(h.id) ? 'ATIVO' : 'INATIVO',
    })),
  });

  await upsertAll({
    label: 'Pets', singular: 'Pets', createMany: 'createPetss', anchorField: 'petIdPetbee',
    anchorMap: petMap,
    changedIds: new Set(dedupedPets.filter(changed).map((p) => String(p.id))),
    rows: dedupedPets.map((p) => ({
      petIdPetbee: String(p.id),
      name: p.name || 'Sem nome',
      especie: p.especie || undefined,
      raca: p.breed || undefined,
      sexo: p.gender === 'M' ? 'MACHO' : p.gender === 'F' ? 'FEMEA' : undefined,
      dataDeNascimento: datePart(p.birthday),
      tutorId: personMap.get(String(petTutor.get(p.id))) || undefined,
    })),
  });

  const planNames = new Map(plans.map((p) => [p.id, p.name]));
  const petNames = new Map(pets.map((p) => [p.id, p.name]));

  await upsertAll({
    label: 'Assinaturas', singular: 'Assinatura', createMany: 'createAssinaturas', anchorField: 'subsIdPetbee',
    anchorMap: subMap,
    changedIds: new Set(subs.filter(changed).map((s) => String(s.id))),
    rows: subs.map((s) => ({
      subsIdPetbee: String(s.id),
      name: `${planNames.get(s.plan_id) ?? 'Plano'} – ${petNames.get(s.pet_id) ?? s.pet_id}`,
      status: subStatus(s),
      periodicidade: s.frequency === 'yearly' ? 'ANUAL' : 'MENSAL',
      valorMensal: { amountMicros: centsToMicros(s.amount), currencyCode: 'BRL' },
      diaVencimento: s.next_recurrency ? new Date(s.next_recurrency).getUTCDate() : undefined,
      dataInicio: datePart(s.start_date),
      dataCancelamento: datePart(s.canceled_at),
      cupom: s.coupon || undefined,
      tutorId: personMap.get(String(s.human_id)) || undefined,
      petId: petMap.get(String(petIdRemap.get(s.pet_id) ?? s.pet_id)) || undefined,
      planoId: planMap.get(String(s.plan_id)) || undefined,
    })),
  });

  writeFileSync(CURSOR_FILE, startedAt.toISOString());
  console.log(`[ok] Sync concluído em ${((Date.now() - startedAt.getTime()) / 1000).toFixed(0)}s`);
};

run().catch((error) => {
  console.error(`[falhou] ${error.message}`);
  process.exit(1);
});
