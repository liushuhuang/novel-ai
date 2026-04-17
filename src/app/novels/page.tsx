'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NovelCard } from '@/components/novels/novel-card'

interface Novel {
  id: string
  title: string
  genre: string
  status: string
  createdAt: string
  provider: { name: string }
  _count: { chapters: number }
}

export default function NovelsPage() {
  const [novels, setNovels] = useState<Novel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/novels')
      .then(res => {
        if (!res.ok) throw new Error(`API error: ${res.status}`)
        return res.json()
      })
      .then(data => { setNovels(data); setLoading(false) })
      .catch(err => {
        console.error('Failed to fetch novels:', err)
        setNovels([])
        setLoading(false)
      })
  }, [])

  if (loading) return <div>加载中...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">我的小说</h1>
          <p className="text-muted-foreground">已创作 {novels.length} 部小说</p>
        </div>
        <Link href="/novels/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            创建小说
          </Button>
        </Link>
      </div>

      {novels.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>还没有创作小说</p>
          <Link href="/novels/new">
            <Button variant="link">开始你的第一部小说</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {novels.map(novel => (
            <NovelCard key={novel.id} novel={novel} />
          ))}
        </div>
      )}
    </div>
  )
}
