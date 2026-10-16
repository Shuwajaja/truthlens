import { useState } from 'react';
import { defineRegistry, JSONUIProvider, Renderer } from '@json-render/react';
import { compositionCatalog, parseComposition, scopedCompositionRuns } from './composition.ts';
import type { WorkspaceDoc } from '../workspace.ts';
import { WorkspaceOverview } from './WorkspaceOverview.tsx';
import { ArtifactCanvas } from './ArtifactCanvas.tsx';
import { RunEvidence, RunTimeline, SourceTrust } from './views.tsx';
import { ProjectMemory } from './ProjectMemory.tsx';

export function ComposedView({ value, doc, project, workspace }: { value: unknown; doc: WorkspaceDoc; project: string; workspace: string }) {
  const [selected, setSelected] = useState('');
  // Revalidate against the current document and scope on every render, including refresh/import.
  let recipe;
  try { recipe = parseComposition(value, doc, project, workspace); }
  catch (error) { return <p role="alert">{error instanceof Error ? error.message : 'This view is unavailable.'}</p>; }
  const sectionIds = recipe.elements[recipe.root].children;
  const active = sectionIds.includes(selected) ? selected : sectionIds[0];
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
  const elements = { ...recipe.elements, [recipe.root]: { ...recipe.elements[recipe.root], children: [active] } };
  return <>
    <div className="composed-section-picker" role="group" aria-label="View sections">
      {sectionIds.map((id, index) => {
        const section = recipe.elements[id];
        const run = 'runId' in section.props ? runs.find(r => r.id === section.props.runId) : undefined;
        const artifact = section.type === 'Result' ? run?.artifacts.find(a => a.id === section.props.artifactId) : undefined;
        const label = section.type === 'Memory' ? 'Project notes' : section.type === 'Timeline' ? 'History' : section.type;
        const repeated = sectionIds.filter(other => recipe.elements[other].type === section.type).length > 1;
        const detail = artifact?.path ?? (repeated ? run?.title ?? String(index + 1) : '');
        return <button key={id} type="button" aria-pressed={id === active} onClick={() => setSelected(id)}>{label}{detail && ` · ${detail}`}</button>;
      })}
    </div>
    <JSONUIProvider registry={registry}><Renderer key={active} spec={{ root: recipe.root, elements }} registry={registry} /></JSONUIProvider>
  </>;
}
