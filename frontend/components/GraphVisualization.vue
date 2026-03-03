<template>
  <v-card title="Family Graph Visualization" class="mb-4">
    <v-card-text>
      <div v-if="focusSummary" class="focus-summary">
        <div class="summary-title">Focused Person: {{ focusSummary.name }}</div>
        <div class="summary-row"><strong>Parents:</strong> {{ formatNames(focusSummary.parents) }}</div>
        <div class="summary-row"><strong>Siblings:</strong> {{ formatNames(focusSummary.siblings) }}</div>
        <div class="summary-row"><strong>Spouse:</strong> {{ formatNames(focusSummary.spouses) }}</div>
        <div class="summary-row"><strong>Children:</strong> {{ formatNames(focusSummary.children) }}</div>
      </div>

      <div class="legend">
        <span class="legend-item self">Self</span>
        <span class="legend-item parent">Parent</span>
        <span class="legend-item sibling">Sibling</span>
        <span class="legend-item spouse">Spouse</span>
        <span class="legend-item child">Child</span>
      </div>

      <div class="tree-wrap">
        <svg class="tree-lines" :width="layout.width" :height="layout.height">
          <g v-for="line in layout.lines" :key="line.id">
            <path
              :d="line.d"
              class="line"
              :class="[lineClassForPersons(line.personIds), { 'line-dimmed': isLineDimmed(line.personIds) }]"
            />
          </g>
        </svg>

        <div
          v-for="node in layout.nodes"
          :key="node.id"
          class="tree-node"
          :class="[
            { 'ancestor-node': node.containsHighlighted, 'node-dimmed': isNodeDimmed(node.personIds) },
            nodeClassForPersons(node.personIds),
          ]"
          :style="{
            left: `${node.x}px`,
            top: `${node.y}px`,
            width: `${node.width}px`,
            height: `${node.height}px`,
          }"
        >
          <template v-if="node.kind === 'couple'">
            <div class="node-title">{{ node.label }}</div>
            <div class="node-subtitle">{{ node.coupleSource === 'inferred' ? 'Couple (inferred)' : 'Couple' }}</div>
          </template>
          <template v-else>
            <div class="node-title">{{ node.label }}</div>
            <div v-for="line in node.detailLines" :key="`${node.id}-${line}`" class="node-subtitle">{{ line }}</div>
          </template>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import type { Person } from '@/types/api';

type CoupleSource = 'explicit' | 'inferred';

type RenderNode = {
  id: string;
  kind: 'single' | 'couple';
  label: string;
  personId: string;
  detailLines: string[];
  personIds: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  containsHighlighted: boolean;
  coupleSource?: CoupleSource;
};

type RenderLine = {
  id: string;
  d: string;
  personIds: string[];
};

type CoupleEdge = {
  a: string;
  b: string;
  source: CoupleSource;
};

const props = defineProps<{
  persons: Person[];
  relationships: Array<{ id: string; fromPersonId: string; toPersonId: string; type: string }>;
  highlightAncestorId?: string;
  focusPersonId?: string;
}>();

const viewportWidth = ref(1200);
const isNarrow = computed(() => viewportWidth.value < 760);
const singleNodeWidth = computed(() => (isNarrow.value ? 176 : 240));
const singleNodeHeight = computed(() => (isNarrow.value ? 84 : 92));
const coupleNodeWidth = computed(() => (isNarrow.value ? 208 : 270));
const coupleNodeHeight = computed(() => (isNarrow.value ? 56 : 64));
const hGap = computed(() => (isNarrow.value ? 18 : 40));
const vGap = computed(() => (isNarrow.value ? 84 : 110));
const padding = computed(() => (isNarrow.value ? 16 : 30));

const syncViewport = (): void => {
  if (!import.meta.client) return;
  viewportWidth.value = window.innerWidth;
};

onMounted(() => {
  syncViewport();
  window.addEventListener('resize', syncViewport, { passive: true });
});

onBeforeUnmount(() => {
  if (!import.meta.client) return;
  window.removeEventListener('resize', syncViewport);
});

const personMap = computed(() => new Map(props.persons.map((p) => [p.id, p])));

const parentEdges = computed(() =>
  props.relationships
    .filter((r) => r.type === 'PARENT')
    .map((r) => ({ parent: r.fromPersonId, child: r.toPersonId })),
);

const explicitSpouseEdges = computed<CoupleEdge[]>(() =>
  props.relationships
    .filter((r) => r.type === 'SPOUSE')
    .map((r) => {
      const [a, b] = [r.fromPersonId, r.toPersonId].sort((x, y) => x.localeCompare(y));
      return { a, b, source: 'explicit' as const };
    }),
);

const inferredCoupleEdges = computed<CoupleEdge[]>(() => {
  const parentByChild = new Map<string, string[]>();
  for (const edge of parentEdges.value) {
    const arr = parentByChild.get(edge.child) ?? [];
    arr.push(edge.parent);
    parentByChild.set(edge.child, arr);
  }

  const inferred = new Map<string, CoupleEdge>();
  for (const [, parents] of parentByChild) {
    const uniq = [...new Set(parents)].sort((a, b) => a.localeCompare(b));
    if (uniq.length < 2) continue;
    for (let i = 0; i < uniq.length; i += 1) {
      for (let j = i + 1; j < uniq.length; j += 1) {
        const a = uniq[i];
        const b = uniq[j];
        inferred.set(`${a}:${b}`, { a, b, source: 'inferred' });
      }
    }
  }

  return [...inferred.values()];
});

const coupleEdges = computed<CoupleEdge[]>(() => {
  const merged = new Map<string, CoupleEdge>();
  for (const edge of inferredCoupleEdges.value) {
    merged.set(`${edge.a}:${edge.b}`, edge);
  }
  for (const edge of explicitSpouseEdges.value) {
    merged.set(`${edge.a}:${edge.b}`, edge);
  }
  return [...merged.values()].sort((x, y) => `${x.a}:${x.b}`.localeCompare(`${y.a}:${y.b}`));
});

const parseMetadata = (raw: string | null | undefined): Record<string, unknown> => {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const formatGender = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 'Unknown';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const formatDob = (value: string | null | undefined): string => {
  if (!value) return '';
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

const buildPersonDetailLines = (person: Person): string[] => {
  const metadata = parseMetadata(person.metadataJson);
  const line1Parts: string[] = [formatGender(person.gender)];
  const dob = formatDob(person.dateOfBirth);
  if (dob) line1Parts.push(dob);

  const email = person.email?.trim() ?? '';
  const phone = person.phone?.trim() ?? '';
  const occupation = typeof metadata.occupation === 'string' ? metadata.occupation.trim() : '';
  const placeOfBirth = typeof metadata.placeOfBirth === 'string' ? metadata.placeOfBirth.trim() : '';
  const line2 = email || phone || occupation || placeOfBirth || 'Profile details pending';

  return [line1Parts.join(' • '), line2];
};

const baseGenerationByPerson = computed(() => {
  const personIds = props.persons.map((p) => p.id);
  const parentMap = new Map<string, string[]>();

  for (const personId of personIds) parentMap.set(personId, []);
  for (const edge of parentEdges.value) {
    const arr = parentMap.get(edge.child) ?? [];
    arr.push(edge.parent);
    parentMap.set(edge.child, arr);
  }

  const roots = personIds.filter((id) => (parentMap.get(id) ?? []).length === 0).sort((a, b) => a.localeCompare(b));
  const generation = new Map<string, number>();
  for (const root of roots) generation.set(root, 0);

  for (let i = 0; i < personIds.length; i += 1) {
    let changed = false;
    for (const personId of personIds.sort((a, b) => a.localeCompare(b))) {
      const parents = parentMap.get(personId) ?? [];
      if (parents.length === 0) {
        if (!generation.has(personId)) {
          generation.set(personId, 0);
          changed = true;
        }
        continue;
      }

      const parentLevels = parents.map((p) => generation.get(p)).filter((v): v is number => v !== undefined);
      if (parentLevels.length > 0) {
        const next = Math.max(...parentLevels) + 1;
        if (generation.get(personId) !== next) {
          generation.set(personId, next);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  for (const personId of personIds) {
    if (!generation.has(personId)) generation.set(personId, 0);
  }
  return generation;
});

const generationByPerson = computed(() => {
  const generation = new Map<string, number>(baseGenerationByPerson.value);

  for (let i = 0; i < props.persons.length * 2; i += 1) {
    let changed = false;

    for (const pair of coupleEdges.value) {
      const ga = generation.get(pair.a) ?? 0;
      const gb = generation.get(pair.b) ?? 0;
      const g = Math.max(ga, gb);
      if (ga !== g) {
        generation.set(pair.a, g);
        changed = true;
      }
      if (gb !== g) {
        generation.set(pair.b, g);
        changed = true;
      }
    }

    for (const edge of parentEdges.value) {
      const gp = generation.get(edge.parent) ?? 0;
      const gc = generation.get(edge.child) ?? 0;
      const nextChild = gp + 1;
      if (gc < nextChild) {
        generation.set(edge.child, nextChild);
        changed = true;
      }
    }

    if (!changed) break;
  }

  return generation;
});

const focusRelations = computed(() => {
  const focusId = props.focusPersonId;
  const empty = {
    self: new Set<string>(),
    parents: new Set<string>(),
    siblings: new Set<string>(),
    spouses: new Set<string>(),
    children: new Set<string>(),
  };
  if (!focusId) return empty;

  const self = new Set<string>([focusId]);
  const parents = new Set<string>();
  const siblings = new Set<string>();
  const spouses = new Set<string>();
  const children = new Set<string>();

  for (const edge of parentEdges.value) {
    if (edge.child === focusId) parents.add(edge.parent);
    if (edge.parent === focusId) children.add(edge.child);
  }

  for (const rel of props.relationships) {
    if (rel.type === 'SPOUSE') {
      if (rel.fromPersonId === focusId) spouses.add(rel.toPersonId);
      if (rel.toPersonId === focusId) spouses.add(rel.fromPersonId);
    }
    if (rel.type === 'SIBLING') {
      if (rel.fromPersonId === focusId) siblings.add(rel.toPersonId);
      if (rel.toPersonId === focusId) siblings.add(rel.fromPersonId);
    }
  }

  for (const parentId of parents) {
    for (const edge of parentEdges.value) {
      if (edge.parent === parentId && edge.child !== focusId) siblings.add(edge.child);
    }
  }

  for (const pair of inferredCoupleEdges.value) {
    if (pair.a === focusId) spouses.add(pair.b);
    if (pair.b === focusId) spouses.add(pair.a);
  }

  return { self, parents, siblings, spouses, children };
});

const focusNeighborhood = computed(() => {
  const focusId = props.focusPersonId;
  if (!focusId) return new Set<string>();
  const union = new Set<string>();
  for (const set of Object.values(focusRelations.value)) {
    for (const id of set) union.add(id);
  }
  return union;
});

const focusSummary = computed(() => {
  const focusId = props.focusPersonId;
  if (!focusId) return null;
  const focusPerson = personMap.value.get(focusId);
  if (!focusPerson) return null;

  const toNames = (ids: Set<string>) =>
    [...ids]
      .map((id) => personMap.value.get(id)?.name ?? id)
      .sort((a, b) => a.localeCompare(b));

  return {
    name: focusPerson.name,
    parents: toNames(focusRelations.value.parents),
    siblings: toNames(focusRelations.value.siblings),
    spouses: toNames(focusRelations.value.spouses),
    children: toNames(focusRelations.value.children),
  };
});

const layout = computed(() => {
  const byGeneration = new Map<number, string[]>();
  for (const person of props.persons) {
    const gen = generationByPerson.value.get(person.id) ?? 0;
    const arr = byGeneration.get(gen) ?? [];
    arr.push(person.id);
    byGeneration.set(gen, arr);
  }

  for (const [gen, ids] of byGeneration) {
    ids.sort((a, b) => (personMap.value.get(a)?.name ?? a).localeCompare(personMap.value.get(b)?.name ?? b));
    byGeneration.set(gen, ids);
  }

  const gens = [...byGeneration.keys()].sort((a, b) => a - b);
  const nodes: RenderNode[] = [];
  const lines: RenderLine[] = [];
  const personToNode = new Map<string, string>();

  for (const gen of gens) {
    const people = [...(byGeneration.get(gen) ?? [])];
    const used = new Set<string>();
    const rowNodes: RenderNode[] = [];

    for (const personId of people) {
      if (used.has(personId)) continue;

      const pair = coupleEdges.value.find(
        (c) =>
          (c.a === personId || c.b === personId) &&
          (generationByPerson.value.get(c.a) ?? 0) === gen &&
          (generationByPerson.value.get(c.b) ?? 0) === gen &&
          !used.has(c.a) &&
          !used.has(c.b),
      );

      if (pair) {
        const a = personMap.value.get(pair.a);
        const b = personMap.value.get(pair.b);
        if (a && b) {
          const id = `couple:${pair.a}:${pair.b}`;
          rowNodes.push({
            id,
            kind: 'couple',
            label: `${a.name} ♥ ${b.name}`,
            personId: `${pair.a},${pair.b}`,
            detailLines: [pair.source === 'inferred' ? 'Couple (inferred)' : 'Couple'],
            personIds: [pair.a, pair.b],
            x: 0,
            y: 0,
            width: coupleNodeWidth.value,
            height: coupleNodeHeight.value,
            containsHighlighted: props.highlightAncestorId === pair.a || props.highlightAncestorId === pair.b,
            coupleSource: pair.source,
          });
          personToNode.set(pair.a, id);
          personToNode.set(pair.b, id);
          used.add(pair.a);
          used.add(pair.b);
          continue;
        }
      }

      const person = personMap.value.get(personId);
      if (!person) continue;
      const id = `single:${personId}`;
      rowNodes.push({
        id,
        kind: 'single',
        label: person.name,
        personId,
        detailLines: buildPersonDetailLines(person),
        personIds: [personId],
        x: 0,
        y: 0,
        width: singleNodeWidth.value,
        height: singleNodeHeight.value,
        containsHighlighted: props.highlightAncestorId === personId,
      });
      personToNode.set(personId, id);
      used.add(personId);
    }

    const rowWidth = rowNodes.reduce((sum, n) => sum + n.width, 0) + Math.max(0, rowNodes.length - 1) * hGap.value;
    let cursorX = padding.value;
    const y = padding.value + gen * (singleNodeHeight.value + vGap.value);
    const targetCanvasWidth = isNarrow.value ? 980 : 1500;
    const rowStart = Math.max(padding.value, rowWidth > 0 ? (targetCanvasWidth - rowWidth) / 2 : padding.value);

    for (const node of rowNodes) {
      node.x = Math.round(rowStart + cursorX - padding.value);
      node.y = Math.round(y);
      cursorX += node.width + hGap.value;
      nodes.push(node);
    }
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const anchorBottom = (n: RenderNode) => ({ x: n.x + n.width / 2, y: n.y + n.height });
  const anchorTop = (n: RenderNode) => ({ x: n.x + n.width / 2, y: n.y });

  for (const node of nodes) {
    if (node.kind !== 'couple') continue;
    lines.push({
      id: `couple-line:${node.id}`,
      d: `M ${node.x + 16} ${node.y + node.height / 2} L ${node.x + node.width - 16} ${node.y + node.height / 2}`,
      personIds: [...node.personIds],
    });
  }

  for (const rel of parentEdges.value) {
    const pNodeId = personToNode.get(rel.parent);
    const cNodeId = personToNode.get(rel.child);
    if (!pNodeId || !cNodeId) continue;
    const pNode = nodeById.get(pNodeId);
    const cNode = nodeById.get(cNodeId);
    if (!pNode || !cNode) continue;

    const start = anchorBottom(pNode);
    const end = anchorTop(cNode);
    const midY = start.y + (end.y - start.y) / 2;
    const d = `M ${start.x} ${start.y} L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.y}`;
    lines.push({ id: `parent:${rel.parent}:${rel.child}`, d, personIds: [rel.parent, rel.child] });
  }

  const width = Math.max(isNarrow.value ? 1080 : 1600, ...nodes.map((n) => n.x + n.width + padding.value));
  const height = Math.max(isNarrow.value ? 430 : 500, ...nodes.map((n) => n.y + n.height + padding.value));
  return { nodes, lines, width, height };
});

const formatNames = (items: string[]): string => (items.length > 0 ? items.join(', ') : 'None');

const hasAny = (personIds: string[], set: Set<string>): boolean => personIds.some((id) => set.has(id));

const nodeClassForPersons = (personIds: string[]): string => {
  if (!props.focusPersonId) return '';
  if (hasAny(personIds, focusRelations.value.self)) return 'focus-self';
  if (hasAny(personIds, focusRelations.value.parents)) return 'focus-parent';
  if (hasAny(personIds, focusRelations.value.siblings)) return 'focus-sibling';
  if (hasAny(personIds, focusRelations.value.spouses)) return 'focus-spouse';
  if (hasAny(personIds, focusRelations.value.children)) return 'focus-child';
  return '';
};

const lineClassForPersons = (personIds: string[]): string => {
  if (!props.focusPersonId) return '';
  if (hasAny(personIds, focusRelations.value.parents)) return 'line-parent';
  if (hasAny(personIds, focusRelations.value.siblings)) return 'line-sibling';
  if (hasAny(personIds, focusRelations.value.spouses)) return 'line-spouse';
  if (hasAny(personIds, focusRelations.value.children)) return 'line-child';
  return '';
};

const isNodeDimmed = (personIds: string[]): boolean => {
  if (!props.focusPersonId) return false;
  return !personIds.some((id) => focusNeighborhood.value.has(id));
};

const isLineDimmed = (personIds: string[]): boolean => {
  if (!props.focusPersonId) return false;
  return !personIds.some((id) => focusNeighborhood.value.has(id));
};
</script>

<style scoped>
.focus-summary {
  border: 1px solid #bfd7e6;
  background: #f4fbff;
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 10px;
}

.summary-title {
  font-weight: 700;
  margin-bottom: 4px;
}

.summary-row {
  font-size: 13px;
  color: #334155;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.legend-item {
  font-size: 12px;
  border-radius: 999px;
  border: 1px solid #d1d5db;
  padding: 3px 8px;
  background: #fff;
}

.legend-item.self {
  border-color: #1d4ed8;
}

.legend-item.parent {
  border-color: #15803d;
}

.legend-item.sibling {
  border-color: #b45309;
}

.legend-item.spouse {
  border-color: #be185d;
}

.legend-item.child {
  border-color: #0369a1;
}

.tree-wrap {
  position: relative;
  overflow: auto;
  border: 1px solid #dbe4ea;
  border-radius: 10px;
  background: linear-gradient(180deg, #f8fbff 0%, #eef6fa 100%);
  min-height: 500px;
  padding: 6px;
}

.tree-lines {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
}

.line {
  fill: none;
  stroke: #7c8b99;
  stroke-width: 1.6;
}

.line-dimmed {
  opacity: 0.16;
}

.line-parent {
  stroke: #15803d;
}

.line-sibling {
  stroke: #b45309;
}

.line-spouse {
  stroke: #be185d;
}

.line-child {
  stroke: #0369a1;
}

.tree-node {
  position: absolute;
  border: 1px solid #0b7285;
  border-radius: 10px;
  background: #fff;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-shadow: 0 1px 2px rgb(0 0 0 / 7%);
  transition: opacity 140ms ease;
}

.node-dimmed {
  opacity: 0.2;
}

.ancestor-node {
  border-color: #ff922b;
  background: #fff4e6;
}

.focus-self {
  border-color: #1d4ed8;
  box-shadow: 0 0 0 2px rgb(29 78 216 / 18%);
}

.focus-parent {
  border-color: #15803d;
}

.focus-sibling {
  border-color: #b45309;
}

.focus-spouse {
  border-color: #be185d;
}

.focus-child {
  border-color: #0369a1;
}

.node-title {
  font-weight: 700;
  font-size: 14px;
  line-height: 1.2;
  color: #1f2937;
}

.node-subtitle {
  font-size: 11px;
  color: #6b7280;
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 900px) {
  .tree-wrap {
    min-height: 420px;
  }
  .node-title {
    font-size: 12px;
  }
  .node-subtitle {
    font-size: 10px;
  }
}

@media (max-width: 640px) {
  .tree-wrap {
    min-height: 360px;
    padding: 4px;
  }
  .focus-summary {
    padding: 8px 10px;
  }
  .summary-row {
    font-size: 12px;
  }
}
</style>
