import {readdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

// The source scan never opens RunDoc exports or translates recorded content.
const words=['belegt','beleg','belege','lauf','läufe','auftrag','ergebnis','übersicht','kriterien','kriterium','nicht','keine','kein','öffnen','schließen','datei','dateien','ereignis','ereignisse','dauer','ende','geprüft','freigabe','später','vorschläge','aussage','aussagen','prüfnachweis','zeitleiste','zeitachse','zeit','offen','signiert','gesamtstatus','unbelegt','fehlgeschlagen','widerspricht','aufgezeichnete','aufgezeichneten','aufgezeichneter','datensatz','datensätze','verbindungen','verknüpfungen','erfasst','exportiert','auswahl','belegnavigation','nachricht','senden','einklappen','ausklappen','arbeitet','spanne','verlauf','und','aus','exportierter','fachliche','lokaler','inhalt','ohne','belegte','verbindung'];
export const germanUI=new RegExp('[äöüß]|(?<![\\p{L}\\p{N}_])(?:'+words.join('|')+')(?![\\p{L}\\p{N}_])','iu');

const dictionaryLine=/^\s+[A-Za-z0-9_]+:\s*['"`]/;
export function referenceCopyViolations(source){
 if(!source.includes('export const copy'))return ['missing copy dictionary'];
 const failures=[];
 source.split('\n').forEach((line,index)=>{
  if(dictionaryLine.test(line))return;
  if(germanUI.test(line))failures.push(String(index+1));
 });
 return failures;
}
async function scan(directory){
 const failures=[];
 const overview=fileURLToPath(new URL('../src/workspace/overview-copy.ts',import.meta.url));
 const referenceCopy=fileURLToPath(new URL('../src/reference/copy.ts',import.meta.url));
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const path=directory+'/'+entry.name;
  if(entry.isDirectory()){failures.push(...await scan(path));continue;}
  // Owner-approved fixed overview dictionary is the sole fully skipped bilingual source.
  if(resolve(path)===overview)continue;
  if(resolve(path)===referenceCopy){
   const issues=referenceCopyViolations(await readFile(path,'utf8'));
   if(issues.length)failures.push(path+':'+issues.join(','));
   continue;
  }
  const lines=(await readFile(path,'utf8')).split('\n');
  lines.forEach((line,index)=>{if(germanUI.test(line))failures.push(path+':'+(index+1));});
 }
 return failures;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const failures=await scan(process.argv[2]??'src');
 if(failures.length){console.error('German UI text found at:\n'+failures.join('\n'));process.exitCode=1;}
 else console.log('UI language: English secondary tools; German overview/run copy confined to the fixed dictionary.');
}
