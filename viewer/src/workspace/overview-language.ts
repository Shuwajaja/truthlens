import {createContext,useContext} from 'react'
import type {OverviewLanguage} from './overview-copy.ts'
export const OverviewLocale=createContext<{language:OverviewLanguage;setLanguage:(language:OverviewLanguage)=>void}>({language:'en',setLanguage:()=>{}})
export const useOverviewLanguage=()=>useContext(OverviewLocale)
