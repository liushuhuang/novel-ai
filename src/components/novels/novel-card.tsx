'use client'

import Link from 'next/link'
import { useState } from 'react'
import { BookOpen, Clock, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface NovelCardProps {
  novel: {
    id: string
    title: string
    genre: string
    status: string
    createdAt: string
    provider: { name: string }
    _count: { chapters: number }
  }
}

export function NovelCard({ novel }: NovelCardProps) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (exporting) return

    setExporting(true)
    try {
      const res = await fetch(`/api/novels/${novel.id}/chapters`)
      if (!res.ok) throw new Error('获取章节失败')

      const chapters: Array<{ number: number; title: string; content: string }> =
        await res.json()

      if (chapters.length === 0) {
        toast.error('该小说暂无章节')
        return
      }

      const lines: string[] = [novel.title, '']
      for (const ch of chapters) {
        lines.push(`第${ch.number}章：${ch.title}`)
        lines.push('')
        lines.push(ch.content)
        lines.push('')
      }

      const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${novel.title}.txt`
      a.click()
      URL.revokeObjectURL(url)

      toast.success(`已导出 ${chapters.length} 章`)
    } catch {
      toast.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="relative group">
      <Link href={`/novels/${novel.id}`}>
        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <CardHeader className="pb-2">
            <CardTitle className="text-base line-clamp-1">{novel.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                {novel._count.chapters} 章
              </span>
              <span>{novel.genre}</span>
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                novel.status === 'generating'
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              }`}>
                {novel.status === 'generating' ? '生成中' : '已完成'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
              <Clock className="h-3 w-3" />
              {new Date(novel.createdAt).toLocaleDateString('zh-CN')}
              <span className="mx-1">·</span>
              {novel.provider.name}
            </div>
          </CardContent>
        </Card>
      </Link>
      {novel._count.chapters > 0 && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleExport}
          disabled={exporting}
          title="导出为 TXT"
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}
