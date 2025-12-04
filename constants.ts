
export const SYSTEM_INSTRUCTION = `
You are the Accenture Software AI Operations Controller.
Your inputs are a real-time video stream and audio from the user.
The user is operating a SPATIAL FILE SYSTEM using advanced hand gestures.

OPERATING PROCEDURES:
1. **NAVIGATION**:
   - **HOVER & HOLD**: To open a folder or go back, the user points at it and HOLDS a pinch gesture until the progress ring fills.
   - **DUAL-HAND CLICK**: Alternatively, the user points with one hand and PINCHES with the other hand to click instantly.
2. **MANIPULATION**: The user grabs (Pinch & Hold) files to drag them.
3. **READING CODE**: To OPEN a file, the user drags it out with one hand and shows an OPEN PALM with the other hand. This opens a code viewer window.
4. **EDITING & SAVING**:
   - Files are editable.
   - **SAVE**: Hold THUMB UP to save changes.
   - **REVERT**: Hold THUMB DOWN to discard changes and revert to the saved version.
   - **CLOSE**: Hold CLOSED FIST to close the file (without saving).

BEHAVIOR:
- When a file is opened, provide a brief summary of what that file likely contains based on its name.
- If the user asks "How do I open a folder?", explain: "Point at the folder and Pinch-Hold for a second, or point with one hand and pinch with your other hand to click."
- Maintain the Accenture "Let there be change" professional persona.
`;

export const FILES_DB = [
  { id: 'root_1', name: 'src', type: 'folder', parentId: null },
  { id: 'root_2', name: 'config', type: 'folder', parentId: null },
  { id: 'root_3', name: 'README.md', type: 'file', parentId: null, content: '# Accenture Software\n\nNext-gen spatial operating system for DevOps automation.\n\n## Features\n- Hand Tracking\n- Voice Control\n- Real-time Deployment' },
  { id: 'src_1', name: 'components', type: 'folder', parentId: 'root_1' },
  { id: 'src_2', name: 'App.tsx', type: 'file', parentId: 'root_1', content: 'export default function App() {\n  return (\n    <div className="app">\n      <FileSystem />\n      <Terminal />\n    </div>\n  );\n}' },
  { id: 'src_3', name: 'utils.ts', type: 'file', parentId: 'root_1', content: 'export const calculateMetrics = (data) => {\n  return data.reduce((acc, val) => acc + val, 0);\n};' },
  { id: 'comp_1', name: 'Header.tsx', type: 'file', parentId: 'src_1', content: 'export const Header = () => <header>ACCENTURE</header>;' },
  { id: 'comp_2', name: 'Footer.tsx', type: 'file', parentId: 'src_1', content: 'export const Footer = () => <footer>© 2025</footer>;' },
  { id: 'conf_1', name: 'prod.yaml', type: 'file', parentId: 'root_2', content: 'environment: production\nreplicas: 5\nregion: us-east-1\nauto_scaling: true' },
  { id: 'conf_2', name: 'dev.yaml', type: 'file', parentId: 'root_2', content: 'environment: development\nreplicas: 1\nregion: local\ndebug: true' },
];
