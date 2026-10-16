const shapes: Record<string, string> = {
  Overview: "M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9",
  Projects: "M3 6h7l2 3h9v11H3Z M3 6V4h7l2 2",
  Results: "M5 3h10l4 4v14H5Z M14 3v5h5 M8 12h8 M8 16h6",
  Activity: "M3 12h4l3-8 4 16 3-8h4",
  Evidence: "M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6Z M8 12l3 3 5-6",
  Knowledge: "M4 4h7v16H4Z M13 4h7v16h-7",
  Sources:
    "M8 8 6 6a3 3 0 0 0-4 4l5 5a3 3 0 0 0 4 0 M16 16l2 2a3 3 0 0 0 4-4l-5-5a3 3 0 0 0-4 0 M8 12l8 0",
  Renderers: "M3 3h7v7H3Z M14 3h7v7h-7Z M3 14h7v7H3Z M14 14h7v7h-7Z",
  Appearance:
    "M12 3a9 9 0 1 0 0 18 3 3 0 0 0 0-6h-1a2 2 0 0 1 0-4h4a4 4 0 0 0 0-8Z",
  Menu: "M4 6h16 M4 12h16 M4 18h16",
  More: "M5 11v2 M12 11v2 M19 11v2",
  Close: "M6 6l12 12 M18 6 6 18",
  Search: "M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
};
export function Icon({ name }: { name: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={shapes[name] ?? shapes.Results} />
    </svg>
  );
}
