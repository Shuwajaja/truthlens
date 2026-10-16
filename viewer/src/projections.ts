import { isRecord, type WorkspaceDoc } from './workspace.ts';
export const projectionViews = ['Results', 'Activity', 'Knowledge', 'Evidence'] as const;
export type Projection = {
  schema_version: 'truthlens.projection/1'; id: string; title: string;
  project_id: string; workspace_id: string | null;
  view: typeof projectionViews[number]; query: string;
};
export const projectionKey = 'truthlens.projections.v1';
const bounded = (x: unknown, max: number) => typeof x === 'string' && x.trim().length > 0 && x.length <= max;
/** Presentation only. No payload, trust fields, action handlers or arbitrary URLs. */
export function validProjection(x: unknown): x is Projection {
  return isRecord(x) && Object.keys(x).sort().join(',') === 'id,project_id,query,schema_version,title,view,workspace_id'
    && x.schema_version === 'truthlens.projection/1' && bounded(x.id, 200) && bounded(x.title, 80)
    && bounded(x.project_id, 512) && (x.workspace_id === null || bounded(x.workspace_id, 512))
    && projectionViews.includes(x.view as Projection['view']) && typeof x.query === 'string' && x.query.length <= 500;
}
export function projectionAvailable(p: Projection, doc: WorkspaceDoc, project: string, workspace: string): boolean {
  return validProjection(p) && p.project_id === project && doc.projects.some(x => x.id === project)
    && (p.workspace_id === null || doc.workspaces.some(x => x.id === p.workspace_id && x.project_id === project))
    && p.workspace_id === (workspace === 'all' ? null : workspace)
    && (p.view !== 'Knowledge' || p.workspace_id === null);
}
export function readProjections(raw: string | null): Projection[] {
  if (!raw || raw.length > 50000) return [];
  try {
    const x: unknown = JSON.parse(raw);
    if (!Array.isArray(x) || x.length > 20 || !x.every(validProjection) || new Set(x.map(p => p.id)).size !== x.length) return [];
    return x;
  } catch { return []; }
}
