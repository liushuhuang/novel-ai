'use client'

interface Chapter {
  id: string
  number: number
  title: string
  wordCount: number
}

interface ChapterListProps {
  chapters: Chapter[]
  activeChapter: number | null
  onSelect: (number: number) => void
}

export function ChapterList({ chapters, activeChapter, onSelect }: ChapterListProps) {
  return (
    <div className="w-64 border-r">
      <div className="p-4 border-b font-medium">章节目录</div>
      <div className="h-[calc(100vh-8rem)] overflow-y-auto">
        <div className="p-2 space-y-1">
          {chapters.map(ch => (
            <button
              key={ch.id}
              onClick={() => onSelect(ch.number)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                activeChapter === ch.number
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              <div className="line-clamp-1">第{ch.number}章：{ch.title}</div>
              <div className="text-xs text-muted-foreground">{ch.wordCount} 字</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
