import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { z } from 'zod';
import { isRecord, type WorkspaceDoc, type Run } from '../workspace.ts';

const empty = z.strictObject({});
const reference = z.strictObject({ runId: z.string().min(1).max(512) });
const resultReference = reference.extend({ artifactId: z.string().min(1).max(512) });
export const compositionCatalog = defineCatalog(schema, { components: {
  Perspective: { props: empty, description: 'One read-only perspective over the selected scope.' },
  Overview: { props: empty, description: 'Recorded workspace overview.' },
  Result: { props: resultReference, description: 'An existing artifact, resolved from the current scoped snapshot.' },
  Checks: { props: reference, description: 'Recorded criteria and agent claims; never generated evidence.' },
  Timeline: { props: reference, description: 'Recorded run events.' },
  Memory: { props: empty, description: 'Project-wide recorded memory; all workspaces only.' },
}, actions: {} });
const key = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/);
const leaf = <T extends string, P extends z.ZodType>(type: T, props: P) => z.strictObject({ type: z.literal(type), props, children: z.array(key).max(0) });
const element = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('Perspective'), props: empty, children: z.array(key).min(1).max(6) }),
  leaf('Overview', empty), leaf('Result', resultReference), leaf('Checks', reference), leaf('Timeline', reference), leaf('Memory', empty),
]);
const recipeSchema = z.strictObject({
  schema_version: z.literal('truthlens.composition/1'),
  project_id: z.string().min(1).max(512),
  workspace_id: z.string().min(1).max(512).nullable(),
  root: key, elements: z.record(key, element),
});
export type Composition = z.infer<typeof recipeSchema>;
export function scopedCompositionRuns(doc: WorkspaceDoc, project: string, workspace: string): Run[] {
  return doc.runs.filter(run => run.project_id === project && (workspace === 'all' || run.workspace_id === workspace));
}
/** Engine syntax is deliberately broader than our contract. Validate before it sees any recipe. */
export function parseComposition(value: unknown, doc: WorkspaceDoc, project: string, workspace: string): Composition {
  if (!isRecord(value) || !isRecord(value.elements) || Object.keys(value.elements).length > 7)
    throw Error('A view needs at most six sections.');
  const parsed = recipeSchema.safeParse(value);
  if (!parsed.success) throw Error('Invalid view recipe. Use only the documented components and record references.');
  const recipe = parsed.data;
  if (recipe.project_id !== project || recipe.workspace_id !== (workspace === 'all' ? null : workspace)
    || !doc.projects.some(p => p.id === project)
    || (workspace !== 'all' && !doc.workspaces.some(w => w.id === workspace && w.project_id === project)))
    throw Error('This view belongs to another project or workspace. Select its original scope.');
  const entries = Object.entries(recipe.elements);
  if (entries.length < 2 || entries.length > 7) throw Error('A view needs between one and six sections.');
  const root = recipe.elements[recipe.root];
  if (!Object.hasOwn(recipe.elements, recipe.root) || !root || root.type !== 'Perspective') throw Error('The root must be a Perspective.');
  const visited = new Set([recipe.root]);
  const sections = new Set<string>();
  const runs = scopedCompositionRuns(doc, project, workspace);
  for (const id of root.children) {
    const section = recipe.elements[id];
    if (visited.has(id) || !Object.hasOwn(recipe.elements, id) || !section || section.type === 'Perspective') throw Error('Repeated, nested or missing sections are not allowed.');
    visited.add(id);
    const identity = JSON.stringify([section.type, section.props]);
    if (sections.has(identity)) throw Error('The same recorded section cannot appear twice.');
    sections.add(identity);
    if (section.type === 'Memory' && workspace !== 'all') throw Error('Memory is project-wide. Select All workspaces to include it.');
    if ('runId' in section.props) {
      const matches = runs.filter(run => run.id === section.props.runId);
      if (matches.length !== 1) throw Error('A referenced run is missing or ambiguous in this scope.');
      if (section.type === 'Result' && matches[0].artifacts.filter(a => a.id === section.props.artifactId).length !== 1)
        throw Error('A referenced result is unavailable in this scope.');
    }
  }
  if (visited.size !== entries.length) throw Error('Unreachable sections are not allowed.');
  if (!compositionCatalog.validate({ root: recipe.root, elements: recipe.elements }).success) throw Error('The renderer could not validate this view.');
  return recipe;
}
export function compositionExample(doc: WorkspaceDoc, project: string, workspace: string): Composition {
  const run = scopedCompositionRuns(doc, project, workspace).find(r => r.integrity !== 'failed');
  const elements: Composition['elements'] = { root: { type: 'Perspective', props: {}, children: ['overview'] }, overview: { type: 'Overview', props: {}, children: [] } };
  if (run) {
    elements.root.children.push('checks');
    elements.checks = { type: 'Checks', props: { runId: run.id }, children: [] };
    if (run.artifacts[0]) { elements.root.children.push('result'); elements.result = { type: 'Result', props: { runId: run.id, artifactId: run.artifacts[0].id }, children: [] }; }
  }
  return { schema_version: 'truthlens.composition/1', project_id: project, workspace_id: workspace === 'all' ? null : workspace, root: 'root', elements };
}
