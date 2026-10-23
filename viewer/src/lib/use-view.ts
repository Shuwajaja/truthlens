// Compatibility type only; useWorkspaceNavigation owns browser history.
import type {WorkspaceView} from '../workspace/navigation-types.ts'
export type View = Exclude<WorkspaceView,'runs'>
