import Link from 'next/link'
import { ArrowRight, BookOpen, Settings, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function HomePage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-4 text-center py-12">
        <h1 className="text-4xl font-bold">AI Novel Generator</h1>
        <p className="text-lg text-muted-foreground">
          配置你的 AI 供应商，设定小说参数，让 AI 为你创作精彩小说
        </p>
        <div className="flex justify-center gap-4 pt-4">
          <Link href="/novels/new">
            <Button size="lg">
              <Sparkles className="h-4 w-4 mr-2" />
              开始创作
            </Button>
          </Link>
          <Link href="/settings/providers">
            <Button variant="outline" size="lg">
              <Settings className="h-4 w-4 mr-2" />
              配置供应商
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" />
              1. 配置供应商
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            添加你的 AI API Key，支持 OpenAI、Claude、Gemini 等多种供应商
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              2. 设定参数
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            选择小说类型、风格、篇幅，让 AI 按你的想法创作
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              3. 流式生成
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            实时观看 AI 生成小说内容，逐字渲染，沉浸式阅读体验
          </CardContent>
        </Card>
      </div>

      <div className="text-center">
        <Link href="/novels" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          查看我的小说 <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}
