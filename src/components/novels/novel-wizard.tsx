"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  GENRES,
  TARGETS,
  WORD_COUNTS,
  STYLES,
  POVS,
  BACKGROUNDS,
} from "@/types/novel"

const novelSchema = z.object({
  providerId: z.string().min(1, "请选择 AI 供应商"),
  genre: z.string().min(1, "请选择题材"),
  target: z.string().min(1, "请选择目标读者"),
  wordCount: z.string().min(1, "请选择字数"),
  style: z.string().min(1, "请选择文风"),
  pov: z.string().min(1, "请选择视角"),
  background: z.string().min(1, "请选择背景"),
  protagonist: z.string().optional(),
  conflict: z.string().optional(),
  customNote: z.string().optional(),
})

type NovelFormValues = z.infer<typeof novelSchema>

interface Provider {
  id: string
  name: string
  type: string
  model: string
}

const STEPS = [
  { title: "选择供应商", description: "选择用于生成小说的 AI 供应商" },
  { title: "小说参数", description: "设置小说的基本参数" },
  { title: "可选设置", description: "补充更多细节（可选）" },
  { title: "确认创建", description: "检查并提交" },
]

const STEP_FIELDS: (keyof NovelFormValues)[][] = [
  ["providerId"],
  ["genre", "target", "wordCount", "style", "pov", "background"],
  [],
  [],
]

export function NovelWizard() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [providers, setProviders] = useState<Provider[]>([])
  const [providersLoading, setProvidersLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<NovelFormValues>({
    resolver: zodResolver(novelSchema),
    defaultValues: {
      providerId: "",
      genre: "",
      target: "",
      wordCount: "",
      style: "",
      pov: "",
      background: "",
      protagonist: "",
      conflict: "",
      customNote: "",
    },
  })

  useEffect(() => {
    fetch("/api/providers")
      .then((res) => res.json())
      .then((data: Provider[]) => {
        setProviders(data)
        setProvidersLoading(false)
        if (data.length === 1) {
          form.setValue("providerId", data[0].id)
        }
      })
      .catch(() => setProvidersLoading(false))
  }, [form])

  const goNext = async () => {
    const fields = STEP_FIELDS[step]
    const valid = await form.trigger(fields as any, { shouldFocus: true })
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const goPrev = () => setStep((s) => Math.max(s - 1, 0))

  const onSubmit = async (values: NovelFormValues) => {
    setSubmitting(true)
    try {
      const res = await fetch("/api/novels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "创建失败")
      }
      const novel = await res.json()
      toast.success("小说创建成功！")
      router.push(`/novels/${novel.id}`)
    } catch (err: any) {
      toast.error(err.message)
      setSubmitting(false)
    }
  }

  const values = form.getValues()
  const selectedProvider = providers.find((p) => p.id === values.providerId)

  if (providersLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (providers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <p className="text-lg text-muted-foreground">请先配置供应商</p>
        <Link href="/settings/providers">
          <Button>前往配置供应商</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (i < step) setStep(i)
              }}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                i < step
                  ? "bg-primary text-primary-foreground cursor-pointer"
                  : i === step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </button>
            {i < STEPS.length - 1 && (
              <div
                className={`h-px w-8 ${
                  i < step ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="text-center">
        <h2 className="text-lg font-semibold">{STEPS[step].title}</h2>
        <p className="text-sm text-muted-foreground">
          {STEPS[step].description}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {/* Step 1: Provider */}
          {step === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>选择 AI 供应商</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="providerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>供应商</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="请选择供应商" />
                          </SelectTrigger>
                          <SelectContent>
                            {providers.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} ({p.model})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Step 2: Novel parameters */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>小说参数</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="genre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>题材</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="请选择题材" />
                          </SelectTrigger>
                          <SelectContent>
                            {GENRES.map((g) => (
                              <SelectItem key={g} value={g}>
                                {g}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="target"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>目标读者</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="请选择目标读者" />
                          </SelectTrigger>
                          <SelectContent>
                            {TARGETS.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="wordCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>字数</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="请选择字数" />
                          </SelectTrigger>
                          <SelectContent>
                            {WORD_COUNTS.map((w) => (
                              <SelectItem key={w.value} value={w.value}>
                                {w.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="style"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>文风</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="请选择文风" />
                          </SelectTrigger>
                          <SelectContent>
                            {STYLES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pov"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>视角</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="请选择视角" />
                          </SelectTrigger>
                          <SelectContent>
                            {POVS.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="background"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>背景</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="请选择背景" />
                          </SelectTrigger>
                          <SelectContent>
                            {BACKGROUNDS.map((b) => (
                              <SelectItem key={b} value={b}>
                                {b}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Step 3: Optional settings */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>可选设置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="protagonist"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>主角设定</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="描述主角的性格、背景、能力等..."
                          className="min-h-24"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="conflict"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>核心冲突</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="描述故事的核心矛盾和冲突..."
                          className="min-h-24"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customNote"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>自定义备注</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="其他要求或灵感..."
                          className="min-h-24"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Step 4: Review */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>确认创建</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-sm">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">供应商</span>
                    <span className="font-medium">
                      {selectedProvider
                        ? `${selectedProvider.name} (${selectedProvider.model})`
                        : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">题材</span>
                    <span className="font-medium">{values.genre || "-"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">目标读者</span>
                    <span className="font-medium">
                      {TARGETS.find((t) => t.value === values.target)?.label ||
                        "-"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">字数</span>
                    <span className="font-medium">
                      {WORD_COUNTS.find((w) => w.value === values.wordCount)
                        ?.label || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">文风</span>
                    <span className="font-medium">{values.style || "-"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">视角</span>
                    <span className="font-medium">{values.pov || "-"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">背景</span>
                    <span className="font-medium">
                      {values.background || "-"}
                    </span>
                  </div>
                  {values.protagonist && (
                    <div className="border-b pb-2">
                      <span className="text-muted-foreground">主角设定</span>
                      <p className="mt-1 font-medium">{values.protagonist}</p>
                    </div>
                  )}
                  {values.conflict && (
                    <div className="border-b pb-2">
                      <span className="text-muted-foreground">核心冲突</span>
                      <p className="mt-1 font-medium">{values.conflict}</p>
                    </div>
                  )}
                  {values.customNote && (
                    <div className="border-b pb-2">
                      <span className="text-muted-foreground">自定义备注</span>
                      <p className="mt-1 font-medium">{values.customNote}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={goPrev}
              disabled={step === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              上一步
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={goNext}>
                下一步
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                创建小说
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  )
}
