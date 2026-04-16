import { NovelWizard } from "@/components/novels/novel-wizard"

export default function NewNovelPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">创建小说</h1>
        <p className="text-muted-foreground">
          通过向导一步步配置，生成你的专属小说
        </p>
      </div>
      <NovelWizard />
    </div>
  )
}
