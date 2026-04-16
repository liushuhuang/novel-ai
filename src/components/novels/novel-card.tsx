import Link from 'next/link'
import { BookOpen, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
  return (
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
  )
}
