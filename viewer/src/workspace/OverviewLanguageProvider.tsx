import {useState,type ReactNode} from 'react'
import {OverviewLocale} from './overview-language.ts'
import type {OverviewLanguage} from './overview-copy.ts'
export function OverviewLanguageProvider({children}:{children:ReactNode}){
 const [language,setLanguage]=useState<OverviewLanguage>('de')
 return <OverviewLocale.Provider value={{language,setLanguage}}>{children}</OverviewLocale.Provider>
}
