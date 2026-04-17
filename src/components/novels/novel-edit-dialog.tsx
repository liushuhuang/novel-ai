'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  GENRES,
  TARGETS,
  WORD_COUNTS,
  STYLES,
  POVS,
  BACKGROUNDS,
} from '@/types/novel'

interface NovelEditData {
  genre: string
  target: string
  wordCount: string
  style: string
  pov: string
  background: string
  protagonist: string | null
  conflict: string | null
  customNote: string | null
}

interface NovelEditDialogProps {
  novelId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData: NovelEditData
  onSaved: () => void
}

export function NovelEditDialog({
  novelId,
  open,
  onOpenChange,
  initialData,
  onSaved,
}: NovelEditDialogProps) {
  const [formData, setFormData] = useState<NovelEditData>(initialData)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/novels/${novelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '保存失败')
      }
      toast.success('设置已保存')
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const update = (field: keyof NovelEditData, value: string | null) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑小说设置</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>题材</Label>
              <Select value={formData.genre} onValueChange={v => update('genre', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GENRES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>频道</Label>
              <Select value={formData.target} onValueChange={v => update('target', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TARGETS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>篇幅</Label>
              <Select value={formData.wordCount} onValueChange={v => update('wordCount', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WORD_COUNTS.map(w => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>文风</Label>
              <Select value={formData.style} onValueChange={v => update('style', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STYLES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>视角</Label>
              <Select value={formData.pov} onValueChange={v => update('pov', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {POVS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>背景</Label>
              <Select value={formData.background} onValueChange={v => update('background', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BACKGROUNDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>主角设定</Label>
            <Textarea
              placeholder="描述主角的性格、背景、能力等..."
              className="min-h-20"
              value={formData.protagonist ?? ''}
              onChange={e => update('protagonist', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>核心冲突</Label>
            <Textarea
              placeholder="描述故事的核心矛盾和冲突..."
              className="min-h-20"
              value={formData.conflict ?? ''}
              onChange={e => update('conflict', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>补充说明</Label>
            <Textarea
              placeholder="其他要求或灵感..."
              className="min-h-20"
              value={formData.customNote ?? ''}
              onChange={e => update('customNote', e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
