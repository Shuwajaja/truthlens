// Browser/AX inspection evidence. This does not emulate spoken screen-reader output.
import assert from 'node:assert/strict'

async function axNode(cdp,selector){
 const {root}=await cdp.send('DOM.getDocument')
 const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector})
 assert(nodeId,`AX target missing: ${selector}`)
 const {node}=await cdp.send('DOM.describeNode',{nodeId})
 const {nodes}=await cdp.send('Accessibility.getPartialAXTree',{backendNodeId:node.backendNodeId,fetchRelatives:false})
 return nodes.find(item=>item.backendDOMNodeId===node.backendNodeId)??nodes[0]
}

export async function reviewDialog(page,cdp){
 const dialog=page.getByRole('dialog')
 if(!await dialog.count())return null
 const node=await axNode(cdp,'[role=dialog]')
 assert(!node.ignored&&node.role.value==='dialog'&&node.name.value,'named dialog exposed to accessibility tree')
 assert(node.properties.some(p=>p.name==='modal'&&p.value.value===true),'modal semantics')
 const background=await axNode(cdp,'.skip-link')
 assert(background.ignored,'modal background excluded from accessibility tree')
 const tab=await axNode(cdp,'[role=dialog] [role=tab][data-state=active]')
 const panel=await axNode(cdp,'[role=dialog] [role=tabpanel][data-state=active]')
 assert(!tab.ignored&&tab.role.value==='tab'&&tab.name.value,'named tab exposed')
 assert(tab.properties.some(p=>p.name==='selected'&&p.value.value===true),'selected tab semantics')
 assert(!panel.ignored&&panel.role.value==='tabpanel'&&panel.name.value===tab.name.value,'panel named by its selected tab')
 const count=await dialog.evaluate(el=>[...el.querySelectorAll('*')].filter(node=>node.tabIndex>=0&&!node.disabled&&node.getClientRects().length).length)
 const sequence=[]
 for(const key of ['Tab','Shift+Tab'])for(let step=0;step<count+2;step++){
  await page.keyboard.press(key)
  const focus=await dialog.evaluate(el=>({contained:el.contains(document.activeElement),tag:document.activeElement?.tagName,name:(document.activeElement?.getAttribute('aria-label')||document.activeElement?.textContent||'').trim().slice(0,120)}))
  assert(focus.contained,`${key}: focus escaped modal`);sequence.push({key,...focus})
 }
 return {dialogName:node.name.value,modal:true,backgroundIgnored:true,tab:tab.name.value,panel:panel.name.value,focusSequence:sequence}
}

export async function reviewIncomplete(page,result){
 const nodes=result.incomplete.flatMap(rule=>rule.nodes.map(node=>({rule:rule.id,target:node.target,checks:[...node.any,...node.all,...node.none]})))
 return page.evaluate(nodes=>{
  const canvas=document.createElement('canvas'),context=canvas.getContext('2d')
  const rgba=value=>{context.clearRect(0,0,1,1);context.fillStyle=value;context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data].map(v=>v/255)}
  const over=(fg,bg)=>fg.slice(0,3).map((v,i)=>v*fg[3]+bg[i]*(1-fg[3]))
  const luminance=rgb=>rgb.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0)
  const contrast=(a,b)=>{const [lo,hi]=[luminance(a),luminance(b)].sort((x,y)=>x-y);return (hi+.05)/(lo+.05)}
  const dialog=document.querySelector('[role=dialog]')
  return nodes.map(node=>{
   const item={rule:node.rule,target:node.target,reasons:node.checks.map(c=>c.data?.messageKey??c.id)}
   if(node.target.length!==1||typeof node.target[0]!=='string')return {...item,outcome:'unresolved',reason:'frame/compound target requires separate review'}
   let el;try{el=document.querySelector(node.target[0])}catch{ /* Retain unresolved selector. */ }
   if(!el)return {...item,outcome:'unresolved',reason:'target not found'}
   const hidden=!!el.closest('[aria-hidden=true]')
   if(dialog&&!dialog.contains(el)&&hidden)return {...item,outcome:'inactive-modal-background',hidden:true}
   if(node.rule==='aria-hidden-focus')return {...item,outcome:'unresolved',reason:'not explained by the verified modal background'}
   if(node.rule!=='color-contrast')return {...item,outcome:'unresolved',reason:'additional rule needs manual review'}
   const chain=[];for(let p=el;p;p=p.parentElement)chain.unshift(p)
   if(chain.some(p=>getComputedStyle(p).backgroundImage!=='none'||+getComputedStyle(p).opacity!==1))return {...item,outcome:'unresolved',reason:'image/opacity requires pixel review'}
   let background=[1,1,1]
   for(const ancestor of chain)background=over(rgba(getComputedStyle(ancestor).backgroundColor),background)
   const style=getComputedStyle(el),foreground=over(rgba(style.color),background)
   const threshold=parseFloat(node.checks.find(c=>c.data?.expectedContrastRatio)?.data.expectedContrastRatio??'4.5')
   const ratio=contrast(foreground,background),rect=el.getBoundingClientRect()
   let top=0,left=0,right=innerWidth,bottom=innerHeight
   for(const ancestor of chain.slice(0,-1)){
    const s=getComputedStyle(ancestor),r=ancestor.getBoundingClientRect()
    if(/auto|scroll|hidden|clip/.test(s.overflowX)){left=Math.max(left,r.left);right=Math.min(right,r.right)}
    if(/auto|scroll|hidden|clip/.test(s.overflowY)){top=Math.max(top,r.top);bottom=Math.min(bottom,r.bottom)}
   }
   const clipped=rect.top<top||rect.left<left||rect.bottom>bottom||rect.right>right
   const x=(Math.max(left,rect.left)+Math.min(right,rect.right))/2,y=(Math.max(top,rect.top)+Math.min(bottom,rect.bottom))/2
   const hit=document.elementFromPoint(x,y),covered=!!hit&&!el.contains(hit)&&!hit.contains(el)
   return {...item,outcome:ratio>=threshold?'css-contrast-pass':'low-contrast',ratio,threshold,foreground,background,clipped,covered}
  })
 },nodes)
}

export async function reviewScrollSample(page,items){
 const sample=items.find(item=>item.outcome==='css-contrast-pass'&&item.clipped)
 if(!sample)return null
 return page.evaluate(async target=>{
  const el=document.querySelector(target),positions=[...document.querySelectorAll('*')].filter(p=>p.scrollHeight>p.clientHeight||p.scrollWidth>p.clientWidth).map(p=>({el:p,left:p.scrollLeft,top:p.scrollTop})),windowPosition={left:scrollX,top:scrollY}
  el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'})
  await new Promise(requestAnimationFrame)
  const rect=el.getBoundingClientRect(),x=Math.max(0,Math.min(innerWidth-1,(rect.left+rect.right)/2)),y=Math.max(0,Math.min(innerHeight-1,(rect.top+rect.bottom)/2)),hit=document.elementFromPoint(x,y)
  const record={target,text:el.textContent.trim().slice(0,140),after:{top:rect.top,bottom:rect.bottom,viewportHeight:innerHeight,hitWithinText:!!hit&&(el.contains(hit)||hit.contains(el))},method:'scroll into view; geometry/hit-test; restore original positions'}
  for(const p of positions){p.el.scrollLeft=p.left;p.el.scrollTop=p.top}
  scrollTo(windowPosition)
  return record
 },sample.target[0])
}
