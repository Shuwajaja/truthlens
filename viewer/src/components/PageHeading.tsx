import type {ReactNode} from 'react'
export function PageHeading({title,description,action,level=1}:{title:string;description?:string;action?:ReactNode;level?:1|2}){
 const Heading=level===1?'h1':'h2'
 return <div className="view-heading"><div><Heading>{title}</Heading>{description&&<p className="text-2">{description}</p>}</div>{action}</div>
}
