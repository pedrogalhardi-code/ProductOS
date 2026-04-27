import { useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Heading from '@tiptap/extension-heading';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { common, createLowlight } from 'lowlight';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Code2,
  Quote,
  Minus,
} from 'lucide-react';
import './RichEditor.css';

const lowlight = createLowlight(common);

interface RichEditorProps {
  content: string;
  onChange: (content: string) => void;
  editable?: boolean;
  placeholder?: string;
}

export default function RichEditor({
  content,
  onChange,
  editable = true,
  placeholder = 'Start typing...',
}: RichEditorProps) {
  const debounceTimer = useRef<NodeJS.Timeout>();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Heading.configure({ levels: [1, 2, 3, 4] }),
      Link.configure({ openOnClick: false }),
      Highlight,
      Typography,
      Placeholder.configure({ placeholder }),
      CodeBlockLowlight.configure({ lowlight }),
      Table.configure({ resizable: false, HTMLAttributes: { class: 'editor-table' } }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    editable,
    onUpdate: ({ editor: ed }) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        onChange(ed.getHTML());
      }, 500);
    },
  });

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  if (!editor) return null;

  const handleToolbarClick = useCallback(
    (action: string) => {
      switch (action) {
        case 'bold':
          editor.chain().focus().toggleBold().run();
          break;
        case 'italic':
          editor.chain().focus().toggleItalic().run();
          break;
        case 'h1':
          editor.chain().focus().toggleHeading({ level: 1 }).run();
          break;
        case 'h2':
          editor.chain().focus().toggleHeading({ level: 2 }).run();
          break;
        case 'h3':
          editor.chain().focus().toggleHeading({ level: 3 }).run();
          break;
        case 'bullet':
          editor.chain().focus().toggleBulletList().run();
          break;
        case 'ordered':
          editor.chain().focus().toggleOrderedList().run();
          break;
        case 'code':
          editor.chain().focus().toggleCodeBlock().run();
          break;
        case 'quote':
          editor.chain().focus().toggleBlockquote().run();
          break;
        case 'hr':
          editor.chain().focus().setHorizontalRule().run();
          break;
      }
    },
    [editor]
  );

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200 overflow-hidden">
      {editable && (
        <div className="flex items-center gap-1 px-4 py-3 border-b border-gray-200 bg-gray-50 flex-wrap flex-shrink-0">
          <button
            onClick={() => handleToolbarClick('bold')}
            className={`p-2 rounded transition ${
              editor.isActive('bold')
                ? 'bg-telus-purple text-white'
                : 'hover:bg-gray-200 text-gray-600'
            }`}
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleToolbarClick('italic')}
            className={`p-2 rounded transition ${
              editor.isActive('italic')
                ? 'bg-telus-purple text-white'
                : 'hover:bg-gray-200 text-gray-600'
            }`}
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-gray-300" />

          <button
            onClick={() => handleToolbarClick('h1')}
            className={`p-2 rounded transition ${
              editor.isActive('heading', { level: 1 })
                ? 'bg-telus-purple text-white'
                : 'hover:bg-gray-200 text-gray-600'
            }`}
            title="Heading 1"
          >
            <Heading1 className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleToolbarClick('h2')}
            className={`p-2 rounded transition ${
              editor.isActive('heading', { level: 2 })
                ? 'bg-telus-purple text-white'
                : 'hover:bg-gray-200 text-gray-600'
            }`}
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleToolbarClick('h3')}
            className={`p-2 rounded transition ${
              editor.isActive('heading', { level: 3 })
                ? 'bg-telus-purple text-white'
                : 'hover:bg-gray-200 text-gray-600'
            }`}
            title="Heading 3"
          >
            <Heading3 className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-gray-300" />

          <button
            onClick={() => handleToolbarClick('bullet')}
            className={`p-2 rounded transition ${
              editor.isActive('bulletList')
                ? 'bg-telus-purple text-white'
                : 'hover:bg-gray-200 text-gray-600'
            }`}
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleToolbarClick('ordered')}
            className={`p-2 rounded transition ${
              editor.isActive('orderedList')
                ? 'bg-telus-purple text-white'
                : 'hover:bg-gray-200 text-gray-600'
            }`}
            title="Ordered List"
          >
            <ListOrdered className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleToolbarClick('code')}
            className={`p-2 rounded transition ${
              editor.isActive('codeBlock')
                ? 'bg-telus-purple text-white'
                : 'hover:bg-gray-200 text-gray-600'
            }`}
            title="Code Block"
          >
            <Code2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleToolbarClick('quote')}
            className={`p-2 rounded transition ${
              editor.isActive('blockquote')
                ? 'bg-telus-purple text-white'
                : 'hover:bg-gray-200 text-gray-600'
            }`}
            title="Blockquote"
          >
            <Quote className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleToolbarClick('hr')}
            className="p-2 hover:bg-gray-200 rounded transition text-gray-600"
            title="Horizontal Rule"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        <EditorContent editor={editor} className="prose prose-sm max-w-none" />
      </div>
    </div>
  );
}
