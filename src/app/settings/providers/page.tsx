"use client"

import { useCallback, useEffect, useState } from "react"
import { PlusIcon, PackageOpenIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ProviderCard, type Provider } from "@/components/providers/provider-card"
import {
  ProviderForm,
  type ProviderFormValues,
} from "@/components/providers/provider-form"

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null)

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/providers")
      if (!res.ok) throw new Error("获取提供商列表失败")
      const data = await res.json()
      setProviders(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProviders()
  }, [fetchProviders])

  function handleAdd() {
    setEditingProvider(null)
    setDialogOpen(true)
  }

  function handleEdit(provider: Provider) {
    setEditingProvider(provider)
    setDialogOpen(true)
  }

  async function handleSubmit(values: ProviderFormValues) {
    try {
      if (editingProvider) {
        const res = await fetch(`/api/providers/${editingProvider.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        })
        if (!res.ok) throw new Error("更新失败")
        toast.success("提供商已更新")
      } else {
        const res = await fetch("/api/providers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        })
        if (!res.ok) throw new Error("创建失败")
        toast.success("提供商已创建")
      }
      setDialogOpen(false)
      fetchProviders()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败")
    }
  }

  async function handleDelete(provider: Provider) {
    if (!confirm(`确定要删除 "${provider.name}" 吗？`)) return
    try {
      const res = await fetch(`/api/providers/${provider.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("删除失败")
      toast.success("提供商已删除")
      fetchProviders()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败")
    }
  }

  async function handleTest(provider: Provider): Promise<boolean> {
    const res = await fetch(`/api/providers/${provider.id}/test`, {
      method: "POST",
    })
    const data = await res.json()
    if (data.success) {
      toast.success("连接成功")
    } else {
      toast.error(data.error ?? "连接失败")
    }
    return data.success
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">提供商设置</h1>
          <p className="text-sm text-muted-foreground">
            管理 AI 提供商配置
          </p>
        </div>
        <Button onClick={handleAdd}>
          <PlusIcon className="mr-1 size-4" />
          添加提供商
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">加载中...</p>
        </div>
      ) : providers.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <PackageOpenIcon className="size-12 text-muted-foreground" />
          <p className="text-muted-foreground">还没有配置任何提供商</p>
          <Button variant="outline" onClick={handleAdd}>
            <PlusIcon className="mr-1 size-4" />
            添加第一个提供商
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onTest={handleTest}
            />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProvider ? "编辑提供商" : "添加提供商"}
            </DialogTitle>
          </DialogHeader>
          <ProviderForm
            defaultValues={
              editingProvider
                ? {
                    name: editingProvider.name,
                    type: editingProvider.type,
                    baseUrl: editingProvider.baseUrl ?? "",
                    apiKey: "",
                    model: editingProvider.model,
                  }
                : undefined
            }
            onSubmit={handleSubmit}
            onCancel={() => setDialogOpen(false)}
            submitLabel={editingProvider ? "更新" : "创建"}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
