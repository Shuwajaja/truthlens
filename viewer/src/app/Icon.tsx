import {
  House,
  Folder,
  FileText,
  Activity,
  ShieldCheck,
  BookOpen,
  Link,
  PanelsTopLeft,
  Palette,
  Menu,
  Ellipsis,
  X,
  Search,
  type LucideIcon,
} from "lucide-react";
const icons: Record<string, LucideIcon> = {
  Overview: House,
  Projects: Folder,
  Results: FileText,
  Activity,
  Evidence: ShieldCheck,
  Knowledge: BookOpen,
  Sources: Link,
  Renderers: PanelsTopLeft,
  Appearance: Palette,
  Menu,
  More: Ellipsis,
  Close: X,
  Search,
};
export function Icon({ name }: { name: string }) {
  const Component = icons[name] ?? FileText;
  return <Component size={20} strokeWidth={1.7} aria-hidden="true" />;
}
