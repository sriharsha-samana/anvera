<template>
  <div>
    <GraphVisualization
      v-if="layoutMode === 'generations'"
      ref="graphRef"
      :persons="visiblePersons"
      :relationships="visibleRelationships"
      :focus-person-id="focusPersonId ?? undefined"
      :proposed-person-ids="proposedPersonIds"
      :proposed-relationship-keys="proposedRelationshipKeys"
      @select-person="$emit('select-person', $event)"
    />

    <v-card v-else-if="layoutMode === 'radial'" class="mb-4" variant="flat">
      <v-card-text>
        <div class="text-caption text-medium-emphasis mb-2">
          Radial Family Layout
          <span class="ml-1">• non-local cross-links are softened to keep the map readable</span>
        </div>
        <svg :viewBox="radialViewBox" class="radial-svg">
          <g>
            <circle
              v-for="r in radialRings"
              :key="`ring-${r}`"
              :cx="radialCenter"
              :cy="radialCenter"
              :r="r"
              fill="none"
              stroke="#64748b"
              stroke-width="1.2"
              stroke-opacity="0.5"
              stroke-dasharray="5 5"
            />
          </g>

          <g>
            <line
              v-for="edge in radialEdges"
              :key="edge.id"
              :x1="edge.x1"
              :y1="edge.y1"
              :x2="edge.x2"
              :y2="edge.y2"
              :stroke="edge.color"
              :stroke-width="edge.width"
              :stroke-dasharray="edge.dash"
              :opacity="edge.opacity"
            />
          </g>

          <g v-for="node in radialNodes" :key="node.id" class="radial-node" @click="onSelect(node.id)">
            <circle
              v-if="node.isContext"
              :cx="node.x"
              :cy="node.y"
              :r="node.radius + 6"
              fill="#d8e9f0"
              fill-opacity="0.72"
              stroke="#7fa6b8"
              stroke-width="1.6"
              stroke-opacity="0.7"
            />
            <circle
              :cx="node.x"
              :cy="node.y"
              :r="node.radius"
              :fill="node.fill"
              :stroke="node.stroke"
              :stroke-width="node.ring === 0 ? 2.8 : 2.3"
            />
            <text :x="node.x" :y="node.y + 4" text-anchor="middle" class="radial-initial">{{ node.initial }}</text>
            <text :x="node.x" :y="node.y + node.radius + 16" text-anchor="middle" class="radial-name">{{ node.name }}</text>
          </g>
        </svg>
      </v-card-text>
    </v-card>

    <v-card v-else class="mb-4" variant="flat">
      <v-card-text>
        <div class="d-flex align-center justify-space-between mb-3">
          <div>
            <div class="text-caption text-medium-emphasis">Timeline Lineage View</div>
            <div class="text-body-2">Members grouped by computed generation depth.</div>
          </div>
        </div>

        <v-timeline side="end" density="compact" line-thickness="2">
          <v-timeline-item
            v-for="entry in timelineRows"
            :key="`gen-${entry.generation}`"
            dot-color="#6f95a0"
            fill-dot
            size="small"
          >
            <template #opposite>
              <div class="text-caption font-weight-semibold">Gen {{ entry.generation }}</div>
            </template>
            <v-card variant="outlined">
              <v-card-text>
                <div class="text-caption text-medium-emphasis mb-2">
                  {{ entry.yearRangeText }}
                </div>
                <div class="d-flex flex-wrap ga-2">
                  <v-chip
                    v-for="person in entry.members"
                    :key="person.id"
                    size="small"
                    :variant="person.id === focusPersonId ? 'flat' : 'tonal'"
                    :class="person.id === focusPersonId ? 'timeline-chip timeline-chip--focus' : 'timeline-chip'"
                    @click="onSelect(person.id)"
                  >
                    {{ person.name }}
                  </v-chip>
                </div>
              </v-card-text>
            </v-card>
          </v-timeline-item>
        </v-timeline>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import type { Person } from '@/types/api';

type Relationship = { id: string; fromPersonId: string; toPersonId: string; type: string };
type GraphLayoutMode = 'generations' | 'radial' | 'timeline';

const props = withDefaults(
  defineProps<{
    persons: Person[];
    relationships: Relationship[];
    layoutMode: GraphLayoutMode;
    focusPersonId?: string | null;
    depth?: number;
    edgeScope?: 'all' | 'blood' | 'marriage';
    parentalSide?: 'all' | 'maternal' | 'paternal';
    proposedPersonIds?: string[];
    proposedRelationshipKeys?: string[];
  }>(),
  {
    focusPersonId: null,
    depth: 2,
    edgeScope: 'all',
    parentalSide: 'all',
    proposedPersonIds: () => [],
    proposedRelationshipKeys: () => [],
  },
);

const graphRef = ref<{ downloadAsImage: (fileName?: string) => Promise<void> } | null>(null);
const personById = computed(() => new Map(props.persons.map((person) => [person.id, person])));

const edgeFilteredRelationships = computed(() => {
  if (props.edgeScope === 'all') return props.relationships;
  const bloodTypes = new Set(['PARENT', 'SIBLING']);
  const marriageTypes = new Set(['SPOUSE', 'INLAW']);
  return props.relationships.filter((relationship) =>
    props.edgeScope === 'blood' ? bloodTypes.has(relationship.type) : marriageTypes.has(relationship.type),
  );
});

const focusNeighborhood = computed(() => {
  if (!props.focusPersonId) return new Set<string>();
  const adjacency = new Map<string, Set<string>>();
  for (const relationship of edgeFilteredRelationships.value) {
    const from = adjacency.get(relationship.fromPersonId) ?? new Set<string>();
    from.add(relationship.toPersonId);
    adjacency.set(relationship.fromPersonId, from);

    const to = adjacency.get(relationship.toPersonId) ?? new Set<string>();
    to.add(relationship.fromPersonId);
    adjacency.set(relationship.toPersonId, to);
  }

  const visited = new Set<string>([props.focusPersonId]);
  const queue: Array<{ id: string; depth: number }> = [{ id: props.focusPersonId, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (current.depth >= (props.depth ?? 2)) continue;
    for (const next of adjacency.get(current.id) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push({ id: next, depth: current.depth + 1 });
    }
  }

  return visited;
});

const parentBranchSet = computed(() => {
  if (!props.focusPersonId || props.parentalSide === 'all') return null;
  const parentEdges = props.relationships.filter((relationship) => relationship.type === 'PARENT');
  const parents = parentEdges
    .filter((edge) => edge.toPersonId === props.focusPersonId)
    .map((edge) => personById.value.get(edge.fromPersonId))
    .filter((person): person is Person => Boolean(person));

  const targetParent = parents.find((parent) =>
    props.parentalSide === 'maternal' ? parent.gender === 'female' : parent.gender === 'male',
  );
  if (!targetParent) return null;

  const adjacency = new Map<string, Set<string>>();
  for (const edge of parentEdges) {
    const a = adjacency.get(edge.fromPersonId) ?? new Set<string>();
    a.add(edge.toPersonId);
    adjacency.set(edge.fromPersonId, a);

    const b = adjacency.get(edge.toPersonId) ?? new Set<string>();
    b.add(edge.fromPersonId);
    adjacency.set(edge.toPersonId, b);
  }

  const visited = new Set<string>([targetParent.id, props.focusPersonId]);
  const queue = [targetParent.id];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    for (const next of adjacency.get(current) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }

  return visited;
});

const visibleIds = computed(() => {
  const all = new Set(props.persons.map((person) => person.id));
  const scopedByDepth = props.focusPersonId ? new Set(focusNeighborhood.value) : all;

  if (parentBranchSet.value) {
    return new Set([...scopedByDepth].filter((id) => parentBranchSet.value?.has(id) || id === props.focusPersonId));
  }

  return props.focusPersonId ? scopedByDepth : all;
});

const visiblePersons = computed(() => props.persons.filter((person) => visibleIds.value.has(person.id)));

const visibleRelationships = computed(() =>
  edgeFilteredRelationships.value.filter(
    (relationship) => visibleIds.value.has(relationship.fromPersonId) && visibleIds.value.has(relationship.toPersonId),
  ),
);

const generationByPerson = computed(() => {
  const map = new Map<string, number>();
  for (const person of visiblePersons.value) map.set(person.id, 0);

  const parentEdges = visibleRelationships.value.filter((relationship) => relationship.type === 'PARENT');
  for (let i = 0; i < visiblePersons.value.length; i += 1) {
    let changed = false;
    for (const edge of parentEdges) {
      const parentGen = map.get(edge.fromPersonId) ?? 0;
      const childGen = map.get(edge.toPersonId) ?? 0;
      if (childGen < parentGen + 1) {
        map.set(edge.toPersonId, parentGen + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return map;
});

const timelineRows = computed(() => {
  const rows = new Map<number, Array<{ id: string; name: string; dateOfBirth?: string | null }>>();
  for (const person of visiblePersons.value) {
    const generation = generationByPerson.value.get(person.id) ?? 0;
    const list = rows.get(generation) ?? [];
    list.push({ id: person.id, name: person.name, dateOfBirth: person.dateOfBirth });
    rows.set(generation, list);
  }

  const yearOf = (value?: string | null): number | null => {
    if (!value) return null;
    const year = Number(value.slice(0, 4));
    return Number.isFinite(year) ? year : null;
  };

  return [...rows.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([generation, members]) => {
      const sortedMembers = members.sort((a, b) => a.name.localeCompare(b.name));
      const years = sortedMembers.map((member) => yearOf(member.dateOfBirth)).filter((year): year is number => year !== null);
      const yearRangeText =
        years.length > 0 ? `Birth years: ${Math.min(...years)} - ${Math.max(...years)}` : 'Birth years: Not available';
      return {
        generation,
        members: sortedMembers,
        yearRangeText,
      };
    });
});

const radialSize = computed(() => {
  const count = visiblePersons.value.length;
  const depth = props.depth ?? 2;
  const scaled = 900 + Math.max(0, count - 10) * 16 + Math.max(0, depth - 2) * 120;
  return Math.min(1800, Math.max(900, scaled));
});
const radialCenter = computed(() => radialSize.value / 2);

const radialCenterId = computed(() => {
  if (props.focusPersonId && visibleIds.value.has(props.focusPersonId)) return props.focusPersonId;
  const degree = new Map<string, number>();
  for (const person of visiblePersons.value) degree.set(person.id, 0);
  for (const relationship of visibleRelationships.value) {
    degree.set(relationship.fromPersonId, (degree.get(relationship.fromPersonId) ?? 0) + 1);
    degree.set(relationship.toPersonId, (degree.get(relationship.toPersonId) ?? 0) + 1);
  }
  return (
    [...degree.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? visiblePersons.value[0]?.id ?? null
  );
});

const radialLayout = computed(() => {
type PositionedNode = {
  id: string;
  x: number;
  y: number;
  radius: number;
  name: string;
  initial: string;
  fill: string;
  stroke: string;
  ring: number;
  isContext?: boolean;
};

  if (visiblePersons.value.length === 0) return { nodes: [] as PositionedNode[], rings: [] as number[] };
  const centerId = radialCenterId.value;
  if (!centerId) return { nodes: [] as PositionedNode[], rings: [] as number[] };

  const adjacency = new Map<string, Array<{ id: string; relType: string }>>();
  for (const person of visiblePersons.value) adjacency.set(person.id, []);
  for (const relationship of visibleRelationships.value) {
    const from = adjacency.get(relationship.fromPersonId) ?? [];
    from.push({ id: relationship.toPersonId, relType: relationship.type });
    adjacency.set(relationship.fromPersonId, from);

    const to = adjacency.get(relationship.toPersonId) ?? [];
    to.push({ id: relationship.fromPersonId, relType: relationship.type });
    adjacency.set(relationship.toPersonId, to);
  }

  const distance = new Map<string, number>([[centerId, 0]]);
  const firstHop = new Map<string, string>([[centerId, centerId]]);
  const queue = [centerId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const currentDistance = distance.get(current) ?? 0;
    const currentFirstHop = firstHop.get(current) ?? centerId;

    for (const next of adjacency.get(current) ?? []) {
      if (!distance.has(next.id)) {
        distance.set(next.id, currentDistance + 1);
        firstHop.set(next.id, current === centerId ? next.id : currentFirstHop);
        queue.push(next.id);
      }
    }
  }

  const relativeGeneration = new Map<string, number>([[centerId, 0]]);
  const generationQueue = [centerId];
  while (generationQueue.length > 0) {
    const current = generationQueue.shift();
    if (!current) break;
    const currentGen = relativeGeneration.get(current) ?? 0;
    for (const relationship of visibleRelationships.value) {
      let neighbor: string | null = null;
      let candidate = currentGen;
      if (relationship.fromPersonId === current || relationship.toPersonId === current) {
        const isFrom = relationship.fromPersonId === current;
        neighbor = isFrom ? relationship.toPersonId : relationship.fromPersonId;
        if (relationship.type === 'PARENT') {
          if (relationship.fromPersonId === current) candidate = currentGen - 1;
          if (relationship.toPersonId === current) candidate = currentGen + 1;
        }
      }
      if (!neighbor) continue;
      if (!relativeGeneration.has(neighbor)) {
        relativeGeneration.set(neighbor, candidate);
        generationQueue.push(neighbor);
        continue;
      }
      const existing = relativeGeneration.get(neighbor) ?? 0;
      if (Math.abs(candidate) < Math.abs(existing)) {
        relativeGeneration.set(neighbor, candidate);
      }
    }
  }

  const ringById = new Map<string, number>();
  for (const person of visiblePersons.value) {
    const id = person.id;
    if (id === centerId) {
      ringById.set(id, 0);
      continue;
    }
    const hop = distance.get(id) ?? 1;
    const gen = relativeGeneration.get(id) ?? 0;
    let ring = Math.max(1, hop);
    if (gen > 0) ring += gen;
    ringById.set(id, ring);
  }

  const rings = [...new Set([...ringById.values()].filter((ring) => ring > 0))].sort((a, b) => a - b);
  const membersByRing = new Map<number, string[]>();
  for (const [id, ring] of ringById.entries()) {
    if (ring === 0) continue;
    const arr = membersByRing.get(ring) ?? [];
    arr.push(id);
    membersByRing.set(ring, arr);
  }

  const ringRadius = new Map<number, number>();
  for (const ring of rings) {
    const count = Math.max(membersByRing.get(ring)?.length ?? 0, 1);
    const minSpacing = 86;
    const baseRadius = 92 + (ring - 1) * 100;
    const minRadius = (count * minSpacing) / (2 * Math.PI);
    ringRadius.set(ring, Math.max(baseRadius, minRadius));
  }

  const maxRadius = Math.max(...[...ringRadius.values(), 1]);
  const radialMaxRadius = radialSize.value * 0.44;
  if (maxRadius > radialMaxRadius) {
    const scale = radialMaxRadius / maxRadius;
    for (const ring of rings) {
      ringRadius.set(ring, (ringRadius.get(ring) ?? 0) * scale);
    }
  }

  const positioned: PositionedNode[] = [];
  const centerPerson = personById.value.get(centerId);
  if (centerPerson) {
    positioned.push({
      id: centerPerson.id,
      x: radialCenter.value,
      y: radialCenter.value,
      radius: 30,
      name: centerPerson.name,
      initial: centerPerson.name.trim().charAt(0).toUpperCase(),
      fill: '#aecfe0',
      stroke: '#2f6078',
      ring: 0,
      isContext: true,
    });
  }

  for (const ring of rings) {
    const ringMembers = membersByRing.get(ring) ?? [];
    if (!ringMembers.length) continue;

    const groupedByBranch = new Map<string, string[]>();
    for (const id of ringMembers) {
      const branch = firstHop.get(id) ?? id;
      const arr = groupedByBranch.get(branch) ?? [];
      arr.push(id);
      groupedByBranch.set(branch, arr);
    }

    const branchEntries = [...groupedByBranch.entries()].sort((a, b) => {
      const aName = personById.value.get(a[0])?.name ?? a[0];
      const bName = personById.value.get(b[0])?.name ?? b[0];
      return aName.localeCompare(bName);
    });

    const total = ringMembers.length;
    const branchGap = 0.15;
    const totalGap = branchGap * branchEntries.length;
    const usableAngle = Math.max(2 * Math.PI - totalGap, Math.PI);
    let cursor = -Math.PI / 2;
    const radius = ringRadius.get(ring) ?? 120;

    for (const [, ids] of branchEntries) {
      const branchAngle = (usableAngle * ids.length) / total;
      ids.sort((a, b) => (personById.value.get(a)?.name ?? a).localeCompare(personById.value.get(b)?.name ?? b));
      ids.forEach((id, index) => {
        const slot = (index + 0.5) / ids.length;
        const angle = cursor + branchAngle * slot;
        const person = personById.value.get(id);
        if (!person) return;
        positioned.push({
          id: person.id,
          x: radialCenter.value + radius * Math.cos(angle),
          y: radialCenter.value + radius * Math.sin(angle),
          radius: 23,
          name: person.name,
          initial: person.name.trim().charAt(0).toUpperCase(),
          fill: '#93c5fd',
          stroke: '#1e3a8a',
          ring,
          isContext: false,
        });
      });
      cursor += branchAngle + branchGap;
    }
  }

  return {
    nodes: positioned,
    rings: rings.map((ring) => ringRadius.get(ring) ?? 0).filter((entry) => entry > 0),
  };
});

const radialNodes = computed(() => radialLayout.value.nodes);

const radialNodeMap = computed(() => new Map(radialNodes.value.map((node) => [node.id, node])));

const radialEdges = computed(() =>
  visibleRelationships.value
    .map((relationship) => {
      const from = radialNodeMap.value.get(relationship.fromPersonId);
      const to = radialNodeMap.value.get(relationship.toPersonId);
      if (!from || !to) return null;
      const ringDelta = Math.abs(from.ring - to.ring);
      const touchesCenter = from.ring === 0 || to.ring === 0;

      // Keep the radial view readable: strongly render local structure, soften/hide long cross-links.
      if (ringDelta > 2 && !touchesCenter) return null;

      const edgeType = relationship.type;
      const color =
        edgeType === 'PARENT' ? '#cbd5e1' : edgeType === 'SPOUSE' || edgeType === 'INLAW' ? '#fde68a' : '#e2e8f0';
      const width = edgeType === 'PARENT' ? 1.8 : edgeType === 'SPOUSE' || edgeType === 'INLAW' ? 1.6 : 1.2;
      const dash = edgeType === 'SPOUSE' || edgeType === 'INLAW' ? '4 4' : '';
      const opacity = ringDelta > 1 ? 0.14 : touchesCenter ? 0.34 : 0.24;

      return {
        id: relationship.id,
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
        color,
        width,
        dash,
        opacity,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        id: string;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        color: string;
        width: number;
        dash: string;
        opacity: number;
      } => Boolean(entry),
    ),
);

const radialRings = computed(() => {
  return radialLayout.value.rings;
});

const radialViewBox = computed(() => {
  if (!radialNodes.value.length) return `0 0 ${radialSize.value} ${radialSize.value}`;

  const maxRing = Math.max(...radialRings.value, 0);
  const contentMinX = Math.min(...radialNodes.value.map((node) => node.x - node.radius), radialCenter.value - maxRing);
  const contentMaxX = Math.max(...radialNodes.value.map((node) => node.x + node.radius), radialCenter.value + maxRing);
  const contentMinY = Math.min(...radialNodes.value.map((node) => node.y - node.radius), radialCenter.value - maxRing);
  const contentMaxY = Math.max(...radialNodes.value.map((node) => node.y + node.radius), radialCenter.value + maxRing);

  const padding = 96;
  const width = Math.max(420, contentMaxX - contentMinX + padding * 2);
  const height = Math.max(420, contentMaxY - contentMinY + padding * 2);
  const x = contentMinX - padding;
  const y = contentMinY - padding;

  return `${x} ${y} ${width} ${height}`;
});

const onSelect = (personId: string): void => {
  emit('select-person', personId);
};

const downloadAsImage = async (fileName?: string): Promise<void> => {
  if (props.layoutMode === 'generations') {
    await graphRef.value?.downloadAsImage(fileName);
    return;
  }

  const name = fileName ?? `anvera-${props.layoutMode}.png`;
  const content = {
    mode: props.layoutMode,
    people: visiblePersons.value.map((person) => person.name),
    relationships: visibleRelationships.value.length,
  };
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name.replace(/\.png$/i, '.json');
  anchor.click();
  URL.revokeObjectURL(url);
};

defineExpose({ downloadAsImage });

const emit = defineEmits<{
  (e: 'select-person', personId: string): void;
}>();
</script>

<style scoped>
.radial-svg {
  width: 100%;
  max-height: 72vh;
}

.radial-node {
  cursor: pointer;
}

.radial-name {
  fill: #0f172a;
  font-size: 14px;
  font-weight: 600;
  paint-order: stroke;
  stroke: #fff;
  stroke-width: 3px;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.radial-initial {
  fill: #0b1220;
  font-size: 14px;
  font-weight: 700;
}

.timeline-chip {
  color: #1f4f5f !important;
  background-color: #e9f1f5 !important;
  border: 1px solid #d2e2e9 !important;
  opacity: 1 !important;
}

.timeline-chip--focus {
  color: #0f2530 !important;
  background-color: #c9deea !important;
  border-color: #a8c4d3 !important;
  font-weight: 600;
}
</style>
