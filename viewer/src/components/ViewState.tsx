import {Card} from './ui/card.tsx'
import {Empty,EmptyDescription,EmptyTitle} from './ui/empty.tsx'
export function ViewState({title,description,error=false}:{title:string;description?:string;error?:boolean}){
 return <div className="view-state" role={error?'alert':undefined}><Card><Empty role={error?undefined:'status'}><EmptyTitle><h1>{title}</h1></EmptyTitle>{description&&<EmptyDescription>{description}</EmptyDescription>}</Empty></Card></div>
}
