import {useId,useRef,type ReactNode} from 'react'
import {criterionStates,criterionTotal,type CriterionCounts,type RunAggregate} from './cross-run-data.ts'
import {overviewCopy,type OverviewCopy} from './overview-copy.ts'

function Chart({title,description,children}:{title:string;description:string;children:ReactNode}){
 const id=useId()
 return <figure className="run-chart" aria-labelledby={id}><figcaption><h3 id={id}>{title}</h3><p>{description}</p></figcaption>{children}</figure>
}
export function CriterionBar({criteria}:{criteria:CriterionCounts}){
 const total=criterionTotal(criteria)
 return <div className="criterion-stack" aria-hidden="true">{criterionStates.map(status=><span key={status} data-criterion={status} style={{width:`${total?criteria[status]/total*100:0}%`}}/>)}</div>
}
export function CriterionText({criteria,copy=overviewCopy.en}:{criteria:CriterionCounts;copy?:OverviewCopy}){
 return <span className="criterion-counts">{criterionStates.map(status=><span key={status} data-criterion={status}>{criteria[status]} {copy[status].toLowerCase()}</span>)}</span>
}
export function ScoreRing({criteria,label,copy}:{criteria:CriterionCounts;label:string;copy:OverviewCopy}){
 const total=criterionTotal(criteria)
 let offset=0
 return <svg data-empty={total===0} className="score-ring" viewBox="0 0 132 132" role="img" aria-label={label}>
  <circle className="ring-track" cx="66" cy="66" r="56"/>
  {total>0&&criterionStates.map(status=>{
   const amount=criteria[status]/total*100,start=offset;offset+=amount
   return amount>0?<circle key={status} data-criterion={status} cx="66" cy="66" r="56" pathLength="100" strokeDasharray={`${amount} ${100-amount}`} strokeDashoffset={-start} transform="rotate(-90 66 66)"/>:null
  })}
  <text textLength={total&&`${criteria.met}/${total}`.length>7?104:undefined} lengthAdjust="spacingAndGlyphs" x="66" y="68" textAnchor="middle" aria-hidden="true">{total?`${criteria.met}/${total}`:'—'}</text>
  <text className="ring-label" x="66" y="87" textAnchor="middle" aria-hidden="true">{total?copy.met.toLowerCase():copy.unverified.toLowerCase()}</text>
 </svg>
}
export function RunCharts({data,copy=overviewCopy.en}:{data:RunAggregate;copy?:OverviewCopy}){
 const strip=useRef<HTMLDivElement>(null)
 const chronological=[...data.latest].reverse()
 const dated=chronological.filter(row=>row.started!==null&&criterionTotal(row.criteria)>0)
 const maxCriteria=Math.max(1,...chronological.map(row=>criterionTotal(row.criteria)))
 const maxEvidence=Math.max(1,...data.evidence.map(e=>e.count))
 const maxAgent=Math.max(1,...data.agents.map(row=>criterionTotal(row.criteria)))
 const point=(index:number)=>({x:8+index/(dated.length-1)*384,y:92-dated[index].criteria.met/criterionTotal(dated[index].criteria)*80})
 const labels=new Map([['Commands',copy.commands],['File changes',copy.files],['Test-file changes',copy.testFiles],['Test reports',copy.reports],['Artifact records',copy.artifacts],['Other recorded evidence',copy.other]])
 const move=(direction:number)=>{const element=strip.current;if(element)element.scrollBy({left:direction*(element.firstElementChild?.getBoundingClientRect().width??element.clientWidth)+direction*12,behavior:'auto'})}
 return <div className="chart-area">
  <div ref={strip} className="run-charts" role="region" aria-label={copy.charts} tabIndex={0}>
   <Chart title={copy.trend} description={copy.trendHelp}>
    {dated.length>=2?<><p className="trend-value">{dated.at(-1)!.criteria.met}/{criterionTotal(dated.at(-1)!.criteria)}</p>
     <svg className="criteria-trend" viewBox="0 0 400 104" role="img" aria-label={copy.trend}>
      <polyline points={dated.map((_,i)=>{const p=point(i);return `${p.x},${p.y}`}).join(' ')}/>
      {dated.map((row,i)=>{const p=point(i);return <circle key={row.runId} cx={p.x} cy={p.y} r="3"><title>{row.runId}: {row.criteria.met}/{criterionTotal(row.criteria)}</title></circle>})}
     </svg></>:<div className="chart-single"><p>{dated.length?copy.trendNeedsRuns:copy.noDates}</p></div>}
    <details className="chart-data"><summary aria-label={copy.chartData} title={copy.chartData}><span aria-hidden="true">⋯</span></summary><ul>{chronological.map(row=><li key={row.runId}><span>{row.runId}</span> · {criterionTotal(row.criteria)?`${row.criteria.met}/${criterionTotal(row.criteria)}`:copy.noCriteria} · {row.started??copy.noStart}</li>)}</ul></details>
   </Chart>
   <Chart title={copy.criteria} description={copy.criteriaHelp}>
    {chronological.length===1?<div className="chart-single"><p>{copy.singleRun}</p>{criterionTotal(chronological[0].criteria)?<CriterionText criteria={chronological[0].criteria} copy={copy}/>:<p>{copy.noCriteria}</p>}</div>:<svg className="criteria-columns" viewBox="0 0 400 108" role="img" aria-label={copy.criteria}>
     {chronological.map((row,index)=>{
      const slot=400/chronological.length,width=Math.min(32,slot-4),x=index*slot+(slot-width)/2
      let bottom=104
      return <g key={row.runId}>{criterionStates.map(status=>{
       const height=row.criteria[status]/maxCriteria*96;bottom-=height
       return height>0?<rect key={status} data-criterion={status} x={x} y={bottom} width={width} height={height} rx="2"><title>{row.runId}: {row.criteria[status]} {copy[status].toLowerCase()}</title></rect>:null
      })}</g>
     })}
    </svg>}
    <details className="chart-data"><summary aria-label={copy.chartData} title={copy.chartData}><span aria-hidden="true">⋯</span></summary><ul>{chronological.map(row=><li key={row.runId}><span>{row.runId}</span><CriterionText criteria={row.criteria} copy={copy}/></li>)}</ul></details>
   </Chart>
   <Chart title={copy.evidence} description={copy.evidenceHelp}>
    {data.evidence.length?<ul className="evidence-bars">{data.evidence.map(({kind,count})=><li key={kind}><span>{labels.get(kind)??kind}</span><span className="evidence-track" aria-hidden="true"><span style={{width:`${count/maxEvidence*100}%`}}/></span><b>{count}</b></li>)}</ul>:<p>{copy.noEvidence}</p>}
   </Chart>
   <Chart title={copy.agents} description={copy.agentsHelp}>
    <ul className="agent-bars">{data.agents.slice(0,14).map(row=><li key={row.agent}><span title={row.agent||copy.noAgent}>{row.agent||copy.noAgent}</span><div aria-hidden="true" style={{width:`${criterionTotal(row.criteria)/maxAgent*100}%`}}><CriterionBar criteria={row.criteria}/></div><b>{criterionTotal(row.criteria)?`${row.criteria.met}/${criterionTotal(row.criteria)}`:'—'}</b></li>)}</ul>
    <details className="chart-data"><summary aria-label={copy.chartData} title={copy.chartData}><span aria-hidden="true">⋯</span></summary><ul>{data.agents.slice(0,14).map(row=><li key={row.agent}>{row.agent||copy.noAgent} · {row.runs} {copy.runs}<CriterionText criteria={row.criteria} copy={copy}/></li>)}</ul></details>
    {data.agents.length>14&&<p>{copy.agentLimit}</p>}
   </Chart>
  </div>
  <div className="chart-controls"><button type="button" onClick={()=>move(-1)} aria-label={copy.previous}>←</button><span>{copy.swipe}</span><button type="button" onClick={()=>move(1)} aria-label={copy.next}>→</button></div>
 </div>
}
