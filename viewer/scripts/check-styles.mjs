import {readdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const palette='red|green|blue|gray|slate|zinc|white|black|purple|emerald|rose|lime|cyan|teal|indigo|violet|pink|fuchsia|sky|stone|neutral|orange|amber|yellow';
const utility=new RegExp('(?:text|bg|border|fill|stroke|divide|ring(?:-offset)?|outline|shadow|decoration|caret|accent|placeholder|from|via|to)-(?:'+palette+')(?:-|/|\\b)','i');
// CSS named-colour keywords (standard vocabulary, no runtime dependency).
const names="aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkgrey|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|green|greenyellow|grey|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightgrey|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightslategrey|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|slategrey|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen";
const namedDeclaration=new RegExp(String.raw`(?:color|background(?:Color)?|fill|stroke|border(?:Color)?)\s*[:=]\s*['"]?(?:`+names+String.raw`)\b`,'i');
const namedUtility=new RegExp(String.raw`(?:text|bg|border|fill|stroke|ring|outline|shadow|from|via|to)-\[(?:`+names+String.raw`)\]`,'i');
export function styleViolations(source){
 const failures=[];
 if(/font-size:\s*(?!(?:12|14|16|20|28)px)[\d.]+px|font-weight:\s*(?!(?:400|500|600)\b)\d+|font-(?:bold|extrabold|black)|text-\[\d/i.test(source))failures.push('typography');
 if(/#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\s*\(/i.test(source)||utility.test(source)||namedDeclaration.test(source)||namedUtility.test(source))failures.push('literal colour');
 if(/(?:linear|radial|conic)-gradient\s*\(|\bbg-(?:gradient|linear|radial|conic)(?:-|\b)|backdrop-(?:blur|filter)|backdrop-filter\s*:|\b(?:drop-shadow|shadow-glow)(?:-|\b)|\p{Extended_Pictographic}/u.test(source))failures.push('decorative effect or emoji');
 return failures;
}
async function scan(directory){
 const failures=[];
 for(const item of await readdir(directory,{withFileTypes:true})){
  const path=resolve(directory,item.name);
  if(item.isDirectory()){failures.push(...await scan(path));continue;}
  if(path===fileURLToPath(new URL('../src/theme.css',import.meta.url)))continue;
  const issues=styleViolations(await readFile(path,'utf8'));
  if(issues.length)failures.push(path+': '+issues.join(', '));
 }
 return failures;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const violations=await scan(process.argv[2]??'src');
 if(violations.length){console.error('Use semantic theme tokens: '+violations.join('\n'));process.exitCode=1;}
 else console.log('All src CSS/JSX/SVG colours use semantic tokens; literals only in theme.css.');
}
