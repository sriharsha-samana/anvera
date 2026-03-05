import type { RelationshipType } from '@prisma/client';
import type { RelationshipClassification, RelationshipEdge, PersonNode } from '../../shared/types';

type AdjacentEdge = {
  from: string;
  to: string;
  edgeId: string;
  type: RelationshipType;
  traversal: 'forward' | 'reverse';
};

type AncestorInfo = {
  ancestorId: string;
  depthA: number;
  depthB: number;
};

export class GraphEngine {
  public buildAdjacencyMap(
    persons: PersonNode[],
    relationships: RelationshipEdge[],
  ): Map<string, AdjacentEdge[]> {
    const map = new Map<string, AdjacentEdge[]>();
    for (const person of persons) {
      map.set(person.id, []);
    }

    for (const edge of relationships) {
      if (!map.has(edge.fromPersonId)) map.set(edge.fromPersonId, []);
      if (!map.has(edge.toPersonId)) map.set(edge.toPersonId, []);

      map.get(edge.fromPersonId)?.push({
        from: edge.fromPersonId,
        to: edge.toPersonId,
        edgeId: edge.id,
        type: edge.type,
        traversal: 'forward',
      });

      map.get(edge.toPersonId)?.push({
        from: edge.toPersonId,
        to: edge.fromPersonId,
        edgeId: edge.id,
        type: edge.type,
        traversal: 'reverse',
      });
    }

    for (const [, edges] of map) {
      edges.sort((a, b) => `${a.to}:${a.edgeId}`.localeCompare(`${b.to}:${b.edgeId}`));
    }

    return map;
  }

  public bfsAllShortestPaths(
    adjacencyMap: Map<string, AdjacentEdge[]>,
    startId: string,
    targetId: string,
    depthLimit: number,
  ): string[][] {
    if (startId === targetId) {
      return [[startId]];
    }

    const queue: string[] = [startId];
    const distances = new Map<string, number>([[startId, 0]]);
    const parents = new Map<string, Set<string>>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      const dist = distances.get(current) ?? Number.MAX_SAFE_INTEGER;
      if (dist >= depthLimit) continue;

      const neighbors = adjacencyMap.get(current) ?? [];
      for (const edge of neighbors) {
        const next = edge.to;
        const nextDist = dist + 1;

        if (!distances.has(next)) {
          distances.set(next, nextDist);
          parents.set(next, new Set([current]));
          queue.push(next);
        } else if (distances.get(next) === nextDist) {
          parents.get(next)?.add(current);
        }
      }
    }

    const shortestDist = distances.get(targetId);
    if (shortestDist === undefined || shortestDist > depthLimit) {
      return [];
    }

    const result: string[][] = [];
    const buildPaths = (node: string, suffix: string[]): void => {
      if (node === startId) {
        result.push([startId, ...suffix]);
        return;
      }
      const ps = [...(parents.get(node) ?? new Set<string>())].sort((a, b) => a.localeCompare(b));
      for (const parent of ps) {
        buildPaths(parent, [node, ...suffix]);
      }
    };

    buildPaths(targetId, []);
    result.sort((a, b) => a.join('>').localeCompare(b.join('>')));
    return result;
  }

  public detectMultiplePaths(paths: string[][]): boolean {
    return paths.length > 1;
  }

  private collectAncestorDepths(
    personId: string,
    relationships: RelationshipEdge[],
    depthLimit: number,
  ): Map<string, number> {
    const parentMap = new Map<string, string[]>();
    for (const rel of relationships) {
      if (rel.type !== 'PARENT') continue;
      const children = parentMap.get(rel.toPersonId) ?? [];
      children.push(rel.fromPersonId);
      parentMap.set(rel.toPersonId, children);
    }
    for (const [, parents] of parentMap) parents.sort((a, b) => a.localeCompare(b));

    const queue: Array<{ id: string; depth: number }> = [{ id: personId, depth: 0 }];
    const depthMap = new Map<string, number>([[personId, 0]]);

    while (queue.length) {
      const current = queue.shift();
      if (!current) break;
      if (current.depth >= depthLimit) continue;

      for (const parent of parentMap.get(current.id) ?? []) {
        const nextDepth = current.depth + 1;
        const existing = depthMap.get(parent);
        if (existing === undefined || nextDepth < existing) {
          depthMap.set(parent, nextDepth);
          queue.push({ id: parent, depth: nextDepth });
        }
      }
    }

    return depthMap;
  }

  public computeLowestCommonAncestor(
    personA: string,
    personB: string,
    relationships: RelationshipEdge[],
    depthLimit: number,
  ): AncestorInfo | null {
    const aAncestors = this.collectAncestorDepths(personA, relationships, depthLimit);
    const bAncestors = this.collectAncestorDepths(personB, relationships, depthLimit);

    let best: AncestorInfo | null = null;

    for (const [ancestorId, depthA] of aAncestors) {
      const depthB = bAncestors.get(ancestorId);
      if (depthB === undefined) continue;
      const score = depthA + depthB;
      if (
        best === null ||
        score < best.depthA + best.depthB ||
        (score === best.depthA + best.depthB && ancestorId.localeCompare(best.ancestorId) < 0)
      ) {
        best = { ancestorId, depthA, depthB };
      }
    }

    return best;
  }

  private findDirectEdge(
    path: string[],
    relationships: RelationshipEdge[],
  ): RelationshipEdge | null {
    if (path.length < 2) return null;
    const from = path[0];
    const to = path[1];
    const direct = relationships.find((r) => r.fromPersonId === from && r.toPersonId === to);
    if (direct) return direct;
    return relationships.find((r) => r.fromPersonId === to && r.toPersonId === from) ?? null;
  }

  private detectParentCycle(relationships: RelationshipEdge[]): boolean {
    const graph = new Map<string, string[]>();
    for (const rel of relationships) {
      if (rel.type !== 'PARENT') continue;
      const arr = graph.get(rel.fromPersonId) ?? [];
      arr.push(rel.toPersonId);
      graph.set(rel.fromPersonId, arr);
      if (!graph.has(rel.toPersonId)) graph.set(rel.toPersonId, []);
    }
    for (const [, children] of graph) children.sort((a, b) => a.localeCompare(b));

    const visiting = new Set<string>();
    const visited = new Set<string>();

    const dfs = (node: string): boolean => {
      if (visiting.has(node)) return true;
      if (visited.has(node)) return false;
      visiting.add(node);
      for (const child of graph.get(node) ?? []) {
        if (dfs(child)) return true;
      }
      visiting.delete(node);
      visited.add(node);
      return false;
    };

    const nodes = [...graph.keys()].sort((a, b) => a.localeCompare(b));
    for (const node of nodes) {
      if (dfs(node)) return true;
    }
    return false;
  }

  public classifyRelationship(
    personA: string,
    personB: string,
    persons: PersonNode[],
    relationships: RelationshipEdge[],
    depthLimit = 8,
  ): RelationshipClassification {
    if (personA === personB) {
      return {
        label: 'Self',
        paths: [[personA]],
        multiplePaths: false,
        cycleDetected: this.detectParentCycle(relationships),
      };
    }

    const adjacency = this.buildAdjacencyMap(persons, relationships);
    const paths = this.bfsAllShortestPaths(adjacency, personA, personB, depthLimit);
    const multiplePaths = this.detectMultiplePaths(paths);
    const cycleDetected = this.detectParentCycle(relationships);

    if (paths.length === 0) {
      return {
        label: 'Unrelated',
        paths: [],
        multiplePaths,
        cycleDetected,
      };
    }

    const shortestPath = paths[0];
    const edge = this.findDirectEdge(shortestPath, relationships);

    if (shortestPath.length === 2 && edge?.type === 'SPOUSE') {
      return { label: 'Spouse', paths, multiplePaths, cycleDetected };
    }

    if (shortestPath.length === 2 && edge?.type === 'PARENT') {
      if (edge.fromPersonId === personA && edge.toPersonId === personB) {
        return { label: 'Parent', paths, multiplePaths, cycleDetected };
      }
      return { label: 'Child', paths, multiplePaths, cycleDetected };
    }

    // Fallback for datasets that model avuncular links via SIBLING + PARENT
    // but do not include complete shared-parent lineage for both siblings.
    if (shortestPath.length === 3) {
      const a = shortestPath[0];
      const b = shortestPath[1];
      const c = shortestPath[2];
      const ab = this.findDirectEdge([a, b], relationships);
      const bc = this.findDirectEdge([b, c], relationships);

      const abIsSibling = ab?.type === 'SIBLING';
      const bcIsParentForward =
        bc?.type === 'PARENT' && bc.fromPersonId === b && bc.toPersonId === c;
      const abIsParentReverse =
        ab?.type === 'PARENT' && ab.fromPersonId === b && ab.toPersonId === a;
      const bcIsSibling = bc?.type === 'SIBLING';

      if (abIsSibling && bcIsParentForward) {
        return { label: 'Uncle/Aunt', paths, multiplePaths, cycleDetected };
      }

      if (abIsParentReverse && bcIsSibling) {
        return { label: 'Niece/Nephew', paths, multiplePaths, cycleDetected };
      }
    }

    const lca = this.computeLowestCommonAncestor(personA, personB, relationships, depthLimit);

    if (lca) {
      if (lca.depthA === 1 && lca.depthB === 1 && personA !== personB) {
        return {
          label: 'Sibling',
          commonAncestorId: lca.ancestorId,
          paths,
          multiplePaths,
          cycleDetected,
        };
      }

      if (lca.depthA === 1 && lca.depthB === 2) {
        return {
          label: 'Uncle/Aunt',
          commonAncestorId: lca.ancestorId,
          paths,
          multiplePaths,
          cycleDetected,
        };
      }

      if (lca.depthA === 2 && lca.depthB === 1) {
        return {
          label: 'Niece/Nephew',
          commonAncestorId: lca.ancestorId,
          paths,
          multiplePaths,
          cycleDetected,
        };
      }

      if (lca.depthA === 2 && lca.depthB === 2) {
        return {
          label: 'Cousin',
          degree: 1,
          removal: 0,
          commonAncestorId: lca.ancestorId,
          paths,
          multiplePaths,
          cycleDetected,
        };
      }

      if (lca.depthA >= 2 && lca.depthB >= 2) {
        const degree = Math.min(lca.depthA, lca.depthB) - 1;
        const removal = Math.abs(lca.depthA - lca.depthB);
        return {
          label: 'Cousin',
          degree,
          removal,
          commonAncestorId: lca.ancestorId,
          paths,
          multiplePaths,
          cycleDetected,
        };
      }

      if (lca.depthA === 0 && lca.depthB >= 2) {
        return {
          label:
            lca.depthB === 2
              ? 'Grandparent'
              : `Great-${'Great-'.repeat(lca.depthB - 3)}Grandparent`,
          paths,
          multiplePaths,
          cycleDetected,
          commonAncestorId: lca.ancestorId,
        };
      }

      if (lca.depthB === 0 && lca.depthA >= 2) {
        return {
          label:
            lca.depthA === 2 ? 'Grandchild' : `Great-${'Great-'.repeat(lca.depthA - 3)}Grandchild`,
          paths,
          multiplePaths,
          cycleDetected,
          commonAncestorId: lca.ancestorId,
        };
      }
    }

    const hasInLaw = paths.some((path) => {
      for (let i = 0; i < path.length - 1; i += 1) {
        const a = path[i];
        const b = path[i + 1];
        const rel =
          relationships.find((r) => r.fromPersonId === a && r.toPersonId === b) ??
          relationships.find((r) => r.fromPersonId === b && r.toPersonId === a);
        if (rel?.type === 'SPOUSE' || rel?.type === 'INLAW') {
          return true;
        }
      }
      return false;
    });

    if (hasInLaw) {
      return { label: 'In-law', paths, multiplePaths, cycleDetected };
    }

    return { label: 'Relative', paths, multiplePaths, cycleDetected };
  }
}
