"use client"

import { useState } from "react"
import {
  PencilIcon,
  TrashIcon,
  WifiIcon,
  CircleCheckIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { PROVIDER_TYPES } from "@/types/provider"

interface Provider {
  id: string
  name: string
  type: string
  baseUrl: string | null
  model: string
  isDefault: boolean
  createdAt: string
}

interface ProviderCardProps {
  provider: Provider
  onEdit: (provider: Provider) => void
  onDelete: (provider: Provider) => void
  onTest: (provider: Provider) => Promise<boolean>
}

export function ProviderCard({
  provider,
  onEdit,
  onDelete,
  onTest,
}: ProviderCardProps) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<boolean | null>(null)

  const typeLabel =
    PROVIDER_TYPES.find((t) => t.value === provider.type)?.label ??
    provider.type

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const success = await onTest(provider)
      setTestResult(success)
    } catch {
      setTestResult(false)
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="grid gap-1">
            <CardTitle className="flex items-center gap-2">
              {provider.name}
              {provider.isDefault && (
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                  默认
                </span>
              )}
            </CardTitle>
            <CardDescription>{typeLabel}</CardDescription>
          </div>
          {testResult !== null && (
            <div className="flex items-center">
              {testResult ? (
                <CircleCheckIcon className="size-5 text-green-500" />
              ) : (
                <OctagonXIcon className="size-5 text-destructive" />
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-1 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">模型:</span>
            <span>{provider.model}</span>
          </div>
          {provider.baseUrl && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">URL:</span>
              <span className="truncate">{provider.baseUrl}</span>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={testing}
        >
          {testing ? (
            <Loader2Icon className="mr-1 size-4 animate-spin" />
          ) : (
            <WifiIcon className="mr-1 size-4" />
          )}
          测试连接
        </Button>
        <Button variant="outline" size="sm" onClick={() => onEdit(provider)}>
          <PencilIcon className="mr-1 size-4" />
          编辑
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onDelete(provider)}
        >
          <TrashIcon className="mr-1 size-4" />
          删除
        </Button>
      </CardFooter>
    </Card>
  )
}

export type { Provider }
