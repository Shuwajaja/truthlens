export function RecordedText({text}:{text:string}){
 if(text.length<=240&&text.split('\n').length<=3)return <p className="step-description">{text}</p>
 return <div className="recorded-text"><p className="step-description">{text.slice(0,160)}…</p><details><summary>Show full text</summary><p className="recorded-full-text">{text}</p></details></div>
}
