'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface StreamingTextProps {
  novelId: string
  onDone?: (info: { chapter: number; title: string; wordCount: number }) => void
  regenerate?: number
}

type SSEEvent =
  | { type: 'chunk'; content: string }
  | { type: 'done'; chapter: number; title: string; wordCount: number }
  | { type: 'error'; message: string }

export function StreamingText({ novelId, onDone, regenerate }: StreamingTextProps) {
  const [text, setText] = useState('')
  const [isStreaming, setIsStreaming] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasStarted = useRef(false)

  const startStream = useCallback(async () => {
    if (hasStarted.current) return
    hasStarted.current = true

    const url = regenerate
      ? `/api/novels/${novelId}/chapters/${regenerate}/regenerate`
      : `/api/novels/${novelId}/generate`

    try {
      const res = await fetch(url, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Generation failed')
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue

          const event: SSEEvent = JSON.parse(trimmed.slice(6))

          if (event.type === 'chunk') {
            setText(prev => prev + event.content)
          } else if (event.type === 'done') {
            setIsStreaming(false)
            onDone?.(event)
          } else if (event.type === 'error') {
            setError(event.message)
            setIsStreaming(false)
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stream failed')
      setIsStreaming(false)
    }
  }, [novelId, regenerate, onDone])

  useEffect(() => {
    startStream()
  }, [startStream])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [text])

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
        生成失败：{error}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="prose prose-lg dark:prose-invert max-w-none">
      <div className="font-serif leading-relaxed whitespace-pre-wrap">
        {text}
        {isStreaming && (
          <span className="inline-block w-0.5 h-5 bg-foreground animate-pulse ml-0.5" />
        )}
      </div>
    </div>
  )
}
