import assert from 'node:assert/strict';
import { compositionExample, parseComposition } from '../src/renderkit/composition.ts';
import type { WorkspaceDoc } from '../src/workspace.ts';
const doc = { projects:[{id:'p',name:'P'},{id:'q',name:'Q'}], workspaces:[{id:'w',name:'W',project_id:'p'}], runs:[{id:'r',project_id:'p',workspace_id:'w',integrity:'hash-only',artifacts:[{id:'a',path:'x.md'}]}], memory:[] } as unknown as WorkspaceDoc;
const recipe = compositionExample(doc,'p','w');
assert.equal(parseComposition(recipe,doc,'p','w').elements.result.type,'Result');
function reject(change: (p: typeof recipe) => unknown, message: string) { const copy=structuredClone(recipe); change(copy); assert.throws(()=>parseComposition(copy,doc,'p','w'),undefined,message); }
reject(p=>Object.assign(p,{actions:{execute:'shell'}}),'actions');
reject(p=>Object.assign(p.elements.result.props,{integrity:'hmac'}),'trust injection');
reject(p=>Object.assign(p.elements.result,{visible:true}),'visibility');
reject(p=>Object.assign(p.elements.result.props,{runId:{$path:'/secret'}}),'expression');
reject(p=>Object.assign(p.elements.result.props,{runId:'foreign'}),'foreign run');
reject(p=>Object.assign(p.elements.result.props,{artifactId:'foreign'}),'foreign artifact');
reject(p=>p.elements.root.children.push('root'),'cycle');
reject(p=>p.elements.root.children.push('checks'),'duplicate');
reject(p=>p.elements.hidden={type:'Overview',props:{},children:[]},'unreachable');
reject(p=>p.elements.checks={type:'Perspective',props:{},children:['result']},'depth');
reject(p=>p.elements.checks={type:'Memory',props:{},children:[]},'memory scope');
reject(p=>p.elements.root.children.push('missing'),'missing');
assert.throws(()=>parseComposition(recipe,doc,'q','all'));
assert.throws(()=>parseComposition(recipe,{...doc,runs:[]},'p','w'));
assert.throws(()=>parseComposition(recipe,{...doc,runs:[...doc.runs,...doc.runs]},'p','w'));
assert.equal(parseComposition(recipe,{...doc,runs:doc.runs.map(r=>({...r,integrity:'failed'}))},'p','w').root,'root'); // Actual components isolate failed content.
console.log('Composition: native catalog, injection, topology, scope and refresh checks passed');
