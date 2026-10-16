import assert from 'node:assert/strict';
import { allowedDiagram } from '../src/renderkit/diagram-policy.ts';
assert(allowedDiagram('flowchart LR\n A[Request] --> B[Result]\n B --> C[Review]'));
for (const source of [
 'flowchart LR\n A@{ img: "https://example.com/image.png" }',
 'flowchart LR\n A[<img src=x>]', 'flowchart LR\n click A "https://example.com"',
 'flowchart LR\n style A fill:url(//example.com/x)', '%%{init: {}}%%\nflowchart LR',
 '---\nconfig: x\n---\nflowchart LR', 'flowchart LR\n A[&lt;img&gt;]',
 'flowchart LR\n A[\\u003cimg]', 'flowchart LR\n'+'a'.repeat(10001),
]) assert(!allowedDiagram(source), source);
console.log('Diagram policy: safe flowchart accepted, 9 active/config/size inputs rejected');
