import {readdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

// The source scan never opens RunDoc exports or translates recorded content.
const words=['belegt','beleg','belege','lauf','läufe','auftrag','ergebnis','übersicht','kriterien','kriterium','nicht','keine','kein','öffnen','schließen','datei','dateien','ereignis','ereignisse','dauer','ende','geprüft','freigabe','später','vorschläge','aussage','aussagen','prüfnachweis','zeitleiste','zeitachse','zeit','offen','signiert','gesamtstatus','unbelegt','fehlgeschlagen','widerspricht','aufgezeichnete','aufgezeichneten','aufgezeichneter','datensatz','datensätze','verbindungen','verknüpfungen','erfasst','exportiert','auswahl','belegnavigation','nachricht','senden','einklappen','ausklappen','arbeitet','spanne','verlauf','und','aus','exportierter','fachliche','lokaler','inhalt','ohne','belegte','verbindung'];
export const germanUI=new RegExp('[äöüß]|(?<![\\p{L}\\p{N}_])(?:'+words.join('|')+')(?![\\p{L}\\p{N}_])','iu');

async function scan(directory){
 const failures=[];
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const path=directory+'/'+entry.name;
  if(entry.isDirectory()){failures.push(...await scan(path));continue;}
  // Owner-approved fixed overview dictionary is the sole bilingual source.
  if(resolve(path)===fileURLToPath(new URL('../src/workspace/overview-copy.ts',import.meta.url)))continue;
  const lines=(await readFile(path,'utf8')).split('\n');
  lines.forEach((line,index)=>{if(germanUI.test(line))failures.push(path+':'+(index+1));});
 }
 return failures;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const failures=await scan(process.argv[2]??'src');
 if(failures.length){console.error('German UI text found at:\n'+failures.join('\n'));process.exitCode=1;}
 else console.log('UI language: English tools/detail; German confined to the fixed overview dictionary.');
}
