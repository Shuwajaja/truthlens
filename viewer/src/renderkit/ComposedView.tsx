import { defineRegistry, JSONUIProvider, Renderer } from '@json-render/react';
import { compositionCatalog, parseComposition, scopedCompositionRuns } from './composition.ts';
import type { WorkspaceDoc } from '../workspace.ts';
import { WorkspaceOverview } from './WorkspaceOverview.tsx';
import { ArtifactCanvas } from './ArtifactCanvas.tsx';
import { RunEvidence, RunTimeline, SourceTrust } from './views.tsx';
import { ProjectMemory } from './ProjectMemory.tsx';

export function ComposedView({ value, doc, project, workspace }: { value: unknown; doc: WorkspaceDoc; project: string; workspace: string }) {
  // Revalidate against the current document and scope on every render, including refresh/import.
  let recipe;
  try { recipe = parseComposition(value, doc, project, workspace); }
  catch (error) { return <p role="alert">{error instanceof Error ? error.message : 'This view is unavailable.'}</p>; }
  const runs = scopedCompositionRuns(doc, project, workspace);
  const scopedDoc = { ...doc, runs };
  const memory = doc.memory.filter(m => m.project_id === project);
  const { registry } = defineRegistry(compositionCatalog, { components: {
    Perspective: ({ children }) => <div className="composed-sections">{children}</div>,
    Overview: () => <WorkspaceOverview doc={scopedDoc} projectId={project} workspaceId={workspace} />,
    Result: ({ props }) => {
      const run = runs.find(r => r.id === props.runId)!;
      return <ArtifactCanvas doc={scopedDoc} run={run} artifact={run.artifacts.find(a => a.id === props.artifactId)!} />;
    },
    Checks: ({ props }) => { const run = runs.find(r => r.id === props.runId)!; return <section><h2>{run.title}</h2><RunEvidence run={run} /><details><summary>Source and verification</summary><SourceTrust run={run} doc={scopedDoc} /></details></section>; },
    Timeline: ({ props }) => { const run = runs.find(r => r.id === props.runId)!; return <section><h2>{run.title}</h2><RunTimeline run={run} /></section>; },
    Memory: () => <ProjectMemory records={memory} projectId={project} total={memory.length} />,
  } });
  return <JSONUIProvider registry={registry}><Renderer spec={{ root: recipe.root, elements: recipe.elements }} registry={registry} /></JSONUIProvider>;
}
