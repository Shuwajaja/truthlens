interface DiffLine {text:string;old?:number;next?:number;mark:string;tone:'open'|'ok'|'fail'}
/** Numbers exist only inside recorded unified hunks, bounded by their declared lengths. */
function diffLines(text:string):DiffLine[]{
 let old=0,next=0,oldLeft=0,nextLeft=0
 return text.split(/\r?\n/).map(text=>{
  const hunk=/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(text)
  if(hunk){old=Number(hunk[1]);next=Number(hunk[3]);oldLeft=Number(hunk[2]??1);nextLeft=Number(hunk[4]??1);return {text,mark:'',tone:'open'}}
  if(text.startsWith('diff --git')){oldLeft=0;nextLeft=0}
  if(text.startsWith('+')&&nextLeft>0){nextLeft--;return {text:text.slice(1),next:next++,mark:'+',tone:'ok'}}
  if(text.startsWith('-')&&oldLeft>0){oldLeft--;return {text:text.slice(1),old:old++,mark:'−',tone:'fail'}}
  if(text.startsWith(' ')&&oldLeft>0&&nextLeft>0){oldLeft--;nextLeft--;return {text:text.slice(1),old:old++,next:next++,mark:' ',tone:'open'}}
  return {text,mark:'',tone:'open'}
 })
}
export function DiffView({text}:{text:string}){
 return <pre tabIndex={0} className="diff-code"><code>{diffLines(text).map((line,i)=><span key={i} className={`diff-line diff-${line.tone}`} data-testid="diff-line">
  <span className="diff-number" data-testid="old-line" aria-hidden="true">{line.old}</span><span className="diff-number" data-testid="new-line" aria-hidden="true">{line.next}</span><span className="diff-mark" aria-hidden="true">{line.mark}</span><span className="diff-source">{line.text||'\u00a0'}</span>
 </span>)}</code></pre>
}
