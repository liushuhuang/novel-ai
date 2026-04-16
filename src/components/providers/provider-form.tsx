"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PROVIDER_TYPES } from "@/types/provider"

const providerSchema = z.object({
  name: z.string().min(1, "名称不能为空"),
  type: z.string().min(1, "请选择提供商类型"),
  baseUrl: z.string().optional(),
  apiKey: z.string().min(1, "API Key 不能为空"),
  model: z.string().min(1, "模型不能为空"),
})

type ProviderFormValues = z.infer<typeof providerSchema>

interface ProviderFormProps {
  defaultValues?: Partial<ProviderFormValues>
  onSubmit: (values: ProviderFormValues) => void
  onCancel: () => void
  submitLabel?: string
}

export function ProviderForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel = "保存",
}: ProviderFormProps) {
  const form = useForm<ProviderFormValues>({
    resolver: zodResolver(providerSchema),
    defaultValues: {
      name: "",
      type: "openai-compatible",
      baseUrl: "",
      apiKey: "",
      model: "",
      ...defaultValues,
    },
  })

  const selectedType = form.watch("type")
  const showBaseUrl =
    selectedType === "openai-compatible" || selectedType === "custom"

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>名称</FormLabel>
              <FormControl>
                <Input placeholder="例如: OpenAI GPT-4" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>类型</FormLabel>
              <FormControl>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择提供商类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {showBaseUrl && (
          <FormField
            control={form.control}
            name="baseUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Base URL</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://api.example.com/v1"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="apiKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>API Key</FormLabel>
              <FormControl>
                <Input type="password" placeholder="sk-..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="model"
          render={({ field }) => (
            <FormItem>
              <FormLabel>模型</FormLabel>
              <FormControl>
                <Input placeholder="例如: gpt-4o" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button type="submit">{submitLabel}</Button>
        </div>
      </form>
    </Form>
  )
}

export type { ProviderFormValues }
