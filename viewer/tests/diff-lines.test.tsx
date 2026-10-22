// @vitest-environment jsdom
import {afterEach,it,expect} from 'vitest'
import {cleanup,render,screen,within} from '@testing-library/react'
import {DiffView} from '../src/components/DiffView.tsx'
afterEach(cleanup)
it('counts real hunk lines without treating file headers as edits or inventing pre-hunk numbers',()=>{
 render(<DiffView text={'diff --git a/a b/a\n--- a/a\n+++ b/a\n@@ -8,2 +12,2 @@\n same\n-old\n+<script>new</script>\n\\ No newline at end of file'}/>);
 const rows=screen.getAllByTestId('diff-line');
 expect(within(rows[1]).getByTestId('old-line').textContent).toBe('');
 expect(within(rows[2]).getByTestId('new-line').textContent).toBe('');
 expect(within(rows[4]).getByTestId('old-line').textContent).toBe('8');
 expect(within(rows[4]).getByTestId('new-line').textContent).toBe('12');
 expect(within(rows[5]).getByTestId('old-line').textContent).toBe('9');
 expect(within(rows[6]).getByTestId('new-line').textContent).toBe('13');
 expect(within(rows[7]).getByTestId('new-line').textContent).toBe('');
 expect(document.querySelector('script')).toBeNull();
})
