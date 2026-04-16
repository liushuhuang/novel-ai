'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { RefreshCw, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChapterList } from '@/components/novels/chapter-list'
import { StreamingText } from '@/components/novels/streaming-text'

interface Chapter {
  id: string
  number: number
  title: string
  content: string
  wordCount: number
}

interface Novel {
  id: string
  title: string
  genre: string
  status: string
  provider: { name: string; model: string }
  chapters: Chapter[]
}

export default function NovelReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [novel, setNovel] = useState<Novel | null>(null)
  const [activeChapter, setActiveChapter] = useState<number | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [regenerating, setRegenerating] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchNovel = useCallback(async () => {
    const res = await fetch(`/api/novels/${id}`)
    const data = await res.json()
    setNovel(data)
    if (!activeChapter && data.chapters.length > 0) {
      setActiveChapter(data.chapters[data.chapters.length - 1].number)
    }
    setLoading(false)
  }, [id, activeChapter])

  useEffect(() => {
    fetchNovel()
  }, [fetchNovel])

  const handleGenerateNext = () => {
    setIsGenerating(true)
    setActiveChapter(null)
  }

  const handleRegenerate = (chapterNum: number) => {
    setRegenerating(chapterNum)
    setActiveChapter(null)
  }

  const handleGenerationDone = () => {
    setIsGenerating(false)
    setRegenerating(null)
    fetchNovel()
  }

  if (loading || !novel) return <div>加载中...</div>

  const currentChapter = activeChapter
    ? novel.chapters.find(c => c.number === activeChapter)
    : null
  const nextChapterNum = novel.chapters.length > 0
    ? Math.max(...novel.chapters.map(c => c.number)) + 1
    : 1

  return (
    <div className="flex h-[calc(100vh-8rem)] -m-6">
      <ChapterList
        chapters={novel.chapters}
        activeChapter={activeChapter}
        onSelect={(num) => {
          setActiveChapter(num)
          setIsGenerating(false)
          setRegenerating(null)
        }}
      />

      <div className="flex-1 overflow-auto">
        <div className="max-w-[680px] mx-auto py-8 px-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">{novel.title}</h1>
            <div className="flex gap-2">
              {currentChapter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRegenerate(currentChapter.number)}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  重新生成
                </Button>
              )}
              <Button size="sm" onClick={handleGenerateNext}>
                <Play className="h-3 w-3 mr-1" />
                生成第{nextChapterNum}章
              </Button>
            </div>
          </div>

          {isGenerating && (
            <div>
              <h2 className="text-lg font-medium mb-4">正在生成第{nextChapterNum}章...</h2>
              <StreamingText
                novelId={id}
                onDone={handleGenerationDone}
              />
            </div>
          )}

          {regenerating && (
            <div>
              <h2 className="text-lg font-medium mb-4">正在重新生成第{regenerating}章...</h2>
              <StreamingText
                novelId={id}
                regenerate={regenerating}
                onDone={handleGenerationDone}
              />
            </div>
          )}

          {currentChapter && !isGenerating && !regenerating && (
            <div>
              <h2 className="text-lg font-medium mb-4">
                第{currentChapter.number}章：{currentChapter.title}
              </h2>
              <div className="font-serif leading-relaxed whitespace-pre-wrap text-base">
                {currentChapter.content}
              </div>
            </div>
          )}

          {!currentChapter && !isGenerating && !regenerating && novel.chapters.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>点击"生成第1章"开始创作</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
