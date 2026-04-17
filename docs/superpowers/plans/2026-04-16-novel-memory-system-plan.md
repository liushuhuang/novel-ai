# Novel Context Memory System Implementation Plan (v2 — InkOS-Inspired)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- []`) syntax for tracking.

**Goal:** Enable coherent long-form novel generation (100+ chapters, 1M+ characters) by introducing a 3-layer memory system inspired by [InkOS](https://github.com/narcooo/inkos)'s truth file architecture.

**Architecture:** Three memory layers — ChapterMemory (per-chapter Observer-style 9-dimension extraction via AI), ArcMemory (per-10-chapter deterministic consolidation), NovelMemory (per-novel deterministic consolidation). InkOS uses 7 truth files + SQLite temporal DB; we adapt the core ideas to PostgreSQL + our web architecture. Key InkOS concepts adopted:
- **9-dimension fact extraction** (characters, locations, resources, relationships, emotions, info flow, plot threads, time, physical state)
- **Hook status tracking** (open → progressing → resolved) instead of flat foreshadowing lists
- **Relevance-based memory retrieval** — score & select top-N relevant items, not full dump
- **Recent chapter endings** for structural continuity

**Tech Stack:** Prisma 7 (PostgreSQL), existing AI provider adapter pattern, TypeScript

---

## Files Structure

| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modify | Add ChapterMemory, ArcMemory, NovelMemory models |
| `src/lib/memory/types.ts` | Create | TypeScript interfaces for memory data |
| `src/lib/memory/chapter.ts` | Create | Observer-style 9-dimension extraction via AI |
| `src/lib/memory/arc.ts` | Create | Compute ArcMemory from ChapterMemories (deterministic) |
| `src/lib/memory/novel.ts` | Create | Compute NovelMemory from all memory layers (deterministic) |
| `src/lib/memory/assemble.ts` | Create | Relevance-based context assembly with token budget |
| `src/lib/memory/extract.ts` | Create | Background extraction pipeline orchestrator |
| `src/lib/prompts/chapter.ts` | Modify | Accept full memory context, not just previousChapterSummary |
| `src/lib/prompts/system.ts` | Modify | Add memory-aware rules to system prompt |
| `src/app/api/novels/[id]/generate/route.ts` | Modify | Load memory, pass to prompt, trigger background extraction |
| `src/app/api/novels/[id]/chapters/[num]/regenerate/route.ts` | Modify | Same memory integration as generate |

---

### Task 1: Database Schema — Memory Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add three memory models to schema.prisma**

Append after the `Chapter` model:

```prisma
model ChapterMemory {
  id            String   @id @default(cuid())
  novelId       String   @map("novel_id")
  chapterNumber Int      @map("chapter_number")
  summary       String   @db.Text
  characters    String   @db.Text // JSON: string[] — names present
  threads       String   @db.Text // JSON: PlotThread[] — threads advanced
  foreshadowing String   @db.Text // JSON: string[] — new hooks planted
  locations     String   @db.Text // JSON: string[]
  events        String   @db.Text // JSON: string[]
  emotions      String   @db.Text // JSON: {character, shift, trigger}[]
  resources     String   @db.Text // JSON: {character, item, delta}[]
  relationships String   @db.Text // JSON: {from, to, change}[]
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt      @map("updated_at")
  novel         Novel    @relation(fields: [novelId], references: [id])

  @@unique([novelId, chapterNumber])
  @@map("chapter_memories")
}

model ArcMemory {
  id            String   @id @default(cuid())
  novelId       String   @map("novel_id")
  arcStart      Int      @map("arc_start")
  arcEnd        Int      @map("arc_end")
  summary       String   @db.Text
  keyEvents     String   @db.Text // JSON: string[]
  activeThreads String   @db.Text // JSON: PlotThread[]
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt      @map("updated_at")
  novel         Novel    @relation(fields: [novelId], references: [id])

  @@unique([novelId, arcStart])
  @@map("arc_memories")
}

model NovelMemory {
  id              String   @id @default(cuid())
  novelId         String   @unique @map("novel_id")
  characters      String   @db.Text // JSON: CharacterInfo[]
  worldRules      String   @db.Text // JSON: string[]
  majorEvents     String   @db.Text // JSON: string[]
  openThreads     String   @db.Text // JSON: PlotThread[]
  foreshadowing   String   @db.Text // JSON: ForeshadowingItem[]
  lastChapterNum  Int      @default(0) @map("last_chapter_num")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt      @map("updated_at")
  novel           Novel    @relation(fields: [novelId], references: [id])

  @@map("novel_memories")
}
```

Add relations to the `Novel` model:

```prisma
model Novel {
  // ... existing fields ...
  chapters        Chapter[]
  chapterMemories ChapterMemory[]
  arcMemories     ArcMemory[]
  novelMemory     NovelMemory?
  // ... rest unchanged
}
```

- [ ] **Step 2: Generate Prisma client and run migration**

```bash
npx prisma generate
npx prisma migrate dev --name add_memory_models
```

Expected: Migration created and applied successfully.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add memory models (ChapterMemory, ArcMemory, NovelMemory)"
```

---

### Task 2: Memory Type Definitions

**Files:**
- Create: `src/lib/memory/types.ts`

- [ ] **Step 1: Create memory type definitions**

```typescript
// ─── Core data structures (inspired by InkOS truth files) ───

export interface PlotThread {
  description: string
  status: 'open' | 'progressing' | 'resolved'
  introducedIn: number
  lastSeenIn: number
}

export interface ForeshadowingItem {
  hint: string
  chapterIntroduced: number
  resolved: boolean
  resolution?: string
}

export interface CharacterInfo {
  name: string
  role: string
  traits: string[]
  currentState: string
  lastSeenIn: number
}

export interface EmotionShift {
  character: string
  shift: string // e.g. "平静 → 愤怒"
  trigger: string
}

export interface ResourceChange {
  character: string
  item: string
  delta: string // e.g. "+1", "消耗殆尽"
}

export interface RelationshipChange {
  from: string
  to: string
  change: string // e.g. "从盟友变为敌人"
}

// ─── Per-layer memory data ───

export interface ChapterMemoryData {
  summary: string           // 150-char compressed summary
  characters: string[]      // character names present
  threads: PlotThread[]     // plot threads advanced this chapter
  foreshadowing: string[]   // new hooks planted this chapter
  locations: string[]
  events: string[]
  emotions: EmotionShift[]
  resources: ResourceChange[]
  relationships: RelationshipChange[]
}

export interface ArcMemoryData {
  summary: string
  keyEvents: string[]
  activeThreads: PlotThread[]
}

export interface NovelMemoryData {
  characters: CharacterInfo[]
  worldRules: string[]
  majorEvents: string[]
  openThreads: PlotThread[]
  foreshadowing: ForeshadowingItem[]
  lastChapterNum: number
}

// ─── Assembled context for prompt injection ───

export interface MemoryContext {
  previousChapterSummary: string  // Last chapter summary (always include)
  recentEndings: string           // Last 2-3 chapter endings for structural continuity
  arcSummary: string              // Current arc summary
  characters: string              // Character list with states
  openThreads: string             // Unresolved plot threads
  foreshadowing: string           // Unresolved foreshadowing
  relationships: string           // Key relationship states
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/memory/types.ts
git commit -m "feat: add memory type definitions (InkOS-inspired 9-dimension model)"
```

---

### Task 3: Chapter Memory Extraction — Observer-Style (AI-powered)

**Files:**
- Create: `src/lib/memory/chapter.ts`

- [ ] **Step 1: Create chapter memory extractor**

InkOS uses a two-phase approach: Observer extracts all facts (over-extracts intentionally), then Reflector merges. We simplify to a single phase that extracts 9 dimensions into structured JSON.

```typescript
import type { AIProvider, ChatMessage } from '@/types/ai'
import type { ChapterMemoryData } from './types'

const OBSERVER_PROMPT = `你是一个小说事实提取专家。从章节正文中提取所有可观察到的事实变化。宁多勿少，不确定是否重要时也要记录。

## 提取维度

1. **角色行为**：谁做了什么，对谁
2. **位置变化**：谁从哪到哪
3. **资源变化**：物品获得/失去/消耗
4. **关系变化**：信任转变、结盟、背叛
5. **情绪变化**：角色情绪从X到Y，触发事件
6. **信息流动**：谁得知了什么，谁仍不知
7. **剧情线索**：新悬念、已有线索推进、线索回收
8. **时间推进**：时间标记、时长
9. **身体状态**：受伤、恢复、战力变化

## 输出格式（严格JSON，不要任何其他文字）

{
  "summary": "2-3句话的章节概要（150字以内）",
  "characters": ["出场角色名"],
  "threads": [{"description": "剧情线描述", "status": "open|progressing|resolved", "introducedIn": 章节号, "lastSeenIn": 章节号}],
  "foreshadowing": ["新埋伏笔描述"],
  "locations": ["出现的地点"],
  "events": ["关键事件"],
  "emotions": [{"character": "角色名", "shift": "情绪变化", "trigger": "触发事件"}],
  "resources": [{"character": "角色名", "item": "物品", "delta": "变化"}],
  "relationships": [{"from": "角色A", "to": "角色B", "change": "关系变化"}]
}

规则：
- 只从正文提取，不推测
- threads的introducedIn和lastSeenIn用实际章节号
- 如果某个维度本章没有变化，返回空数组`

export async function extractChapterMemory(
  aiProvider: AIProvider,
  chapterNumber: number,
  chapterContent: string,
): Promise<ChapterMemoryData> {
  const messages: ChatMessage[] = [
    { role: 'system', content: OBSERVER_PROMPT },
    { role: 'user', content: `请提取第${chapterNumber}章中的所有事实：\n\n${chapterContent}` },
  ]

  let result = ''
  for await (const chunk of aiProvider.generateStream(messages)) {
    result += chunk
  }

  // Strip markdown code fences if present
  const cleaned = result.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')

  try {
    const parsed = JSON.parse(cleaned)
    return {
      summary: parsed.summary ?? '',
      characters: parsed.characters ?? [],
      threads: parsed.threads ?? [],
      foreshadowing: parsed.foreshadowing ?? [],
      locations: parsed.locations ?? [],
      events: parsed.events ?? [],
      emotions: parsed.emotions ?? [],
      resources: parsed.resources ?? [],
      relationships: parsed.relationships ?? [],
    }
  } catch {
    // Fallback: use raw text as summary
    return {
      summary: result.trim().slice(0, 300),
      characters: [],
      threads: [],
      foreshadowing: [],
      locations: [],
      events: [],
      emotions: [],
      resources: [],
      relationships: [],
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/memory/chapter.ts
git commit -m "feat: add Observer-style 9-dimension chapter memory extractor"
```

---

### Task 4: Arc Memory Computation (Deterministic)

**Files:**
- Create: `src/lib/memory/arc.ts`

- [ ] **Step 1: Create arc memory consolidator**

```typescript
import type { ChapterMemoryData, ArcMemoryData, PlotThread } from './types'

const ARC_SIZE = 10

export function computeArcMemories(
  chapterMemories: { chapterNumber: number; data: ChapterMemoryData }[],
): ArcMemoryData[] {
  const arcs: ArcMemoryData[] = []

  for (let i = 0; i < chapterMemories.length; i += ARC_SIZE) {
    const slice = chapterMemories.slice(i, i + ARC_SIZE)
    if (slice.length === 0) continue

    const allEvents = slice.flatMap(cm => cm.data.events)
    const allThreads = new Map<string, PlotThread>()

    for (const cm of slice) {
      for (const thread of cm.data.threads) {
        const existing = allThreads.get(thread.description)
        if (!existing || thread.lastSeenIn > existing.lastSeenIn) {
          allThreads.set(thread.description, thread)
        }
      }
    }

    const summaries = slice.map(cm => `第${cm.chapterNumber}章: ${cm.data.summary}`)
    const arcStart = slice[0].chapterNumber
    const arcEnd = slice[slice.length - 1].chapterNumber

    arcs.push({
      summary: `第${arcStart}-${arcEnd}章概要：\n${summaries.join('\n')}`,
      keyEvents: allEvents.slice(0, 20),
      activeThreads: Array.from(allThreads.values()).filter(t => t.status !== 'resolved'),
    })
  }

  return arcs
}

export function getArcIndex(chapterNumber: number): number {
  return Math.floor((chapterNumber - 1) / ARC_SIZE)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/memory/arc.ts
git commit -m "feat: add deterministic arc memory computation"
```

---

### Task 5: Novel Memory Computation (Deterministic)

**Files:**
- Create: `src/lib/memory/novel.ts`

- [ ] **Step 1: Create novel memory consolidator**

```typescript
import type {
  ChapterMemoryData,
  ArcMemoryData,
  NovelMemoryData,
  CharacterInfo,
  PlotThread,
  ForeshadowingItem,
} from './types'

export function computeNovelMemory(
  chapterMemories: { chapterNumber: number; data: ChapterMemoryData }[],
  arcMemories: ArcMemoryData[],
  existingMemory: NovelMemoryData | null,
): NovelMemoryData {
  // Merge characters
  const charMap = new Map<string, CharacterInfo>()
  if (existingMemory) {
    for (const c of existingMemory.characters) {
      charMap.set(c.name, c)
    }
  }

  for (const cm of chapterMemories) {
    for (const name of cm.data.characters) {
      const existing = charMap.get(name)
      if (!existing) {
        charMap.set(name, {
          name,
          role: 'unknown',
          traits: [],
          currentState: `首次出现于第${cm.chapterNumber}章`,
          lastSeenIn: cm.chapterNumber,
        })
      } else {
        // Update lastSeenIn
        charMap.set(name, { ...existing, lastSeenIn: cm.chapterNumber })
      }
    }
  }

  // Merge plot threads: keep latest status
  const threadMap = new Map<string, PlotThread>()
  if (existingMemory) {
    for (const t of existingMemory.openThreads) {
      threadMap.set(t.description, t)
    }
  }
  for (const cm of chapterMemories) {
    for (const t of cm.data.threads) {
      const existing = threadMap.get(t.description)
      if (!existing || t.lastSeenIn > existing.lastSeenIn) {
        threadMap.set(t.description, t)
      }
    }
  }

  // Merge foreshadowing
  const foreshadowingList: ForeshadowingItem[] = existingMemory?.foreshadowing ?? []
  const existingHints = new Set(foreshadowingList.map(f => f.hint))
  for (const cm of chapterMemories) {
    for (const hint of cm.data.foreshadowing) {
      if (!existingHints.has(hint)) {
        foreshadowingList.push({
          hint,
          chapterIntroduced: cm.chapterNumber,
          resolved: false,
        })
        existingHints.add(hint)
      }
    }
  }

  // World rules: accumulate from existing
  const worldRules = existingMemory?.worldRules ?? []

  // Major events: merge from arcs
  const majorEvents = arcMemories.flatMap(a => a.keyEvents).slice(0, 50)

  const lastChapterNum = chapterMemories.length > 0
    ? chapterMemories[chapterMemories.length - 1].chapterNumber
    : existingMemory?.lastChapterNum ?? 0

  return {
    characters: Array.from(charMap.values()),
    worldRules,
    majorEvents,
    openThreads: Array.from(threadMap.values()).filter(t => t.status !== 'resolved'),
    foreshadowing: foreshadowingList.filter(f => !f.resolved),
    lastChapterNum,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/memory/novel.ts
git commit -m "feat: add deterministic novel memory consolidation"
```

---

### Task 6: Memory Context Assembly with Relevance Scoring (InkOS-inspired)

**Files:**
- Create: `src/lib/memory/assemble.ts`

InkOS's key insight: don't dump all memory into context. Instead, score each item by relevance to the current chapter goal and recency, then select top-N. We adapt this approach.

- [ ] **Step 1: Create context assembler**

```typescript
import type { MemoryContext, NovelMemoryData, ArcMemoryData, ChapterMemoryData, PlotThread, ForeshadowingItem } from './types'

function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const otherChars = text.length - chineseChars
  return Math.ceil(chineseChars * 2 + otherChars * 0.5)
}

const MEMORY_BUDGET_TOKENS = 3000

function scoreByRecency(chapterNumber: number, lastSeenIn: number): number {
  const age = Math.max(0, chapterNumber - lastSeenIn)
  return Math.max(0, 12 - age)
}

function selectTopThreads(
  threads: PlotThread[],
  chapterNumber: number,
  limit: number,
): PlotThread[] {
  return threads
    .map(t => ({ t, score: scoreByRecency(chapterNumber, t.lastSeenIn) + (t.status === 'open' ? 5 : 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(e => e.t)
}

function selectTopForeshadowing(
  items: ForeshadowingItem[],
  chapterNumber: number,
  limit: number,
): ForeshadowingItem[] {
  return items
    .map(f => ({ f, score: scoreByRecency(chapterNumber, f.chapterIntroduced) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(e => e.f)
}

export function assembleMemoryContext(
  chapterNumber: number,
  chapterMemories: Map<number, ChapterMemoryData>,
  arcMemories: ArcMemoryData[],
  novelMemory: NovelMemoryData | null,
  recentChapterContents?: Map<number, string>,
): MemoryContext {
  // 1. Previous chapter summary (always include — highest priority)
  const prevMemory = chapterMemories.get(chapterNumber - 1)
  const previousChapterSummary = prevMemory?.summary ?? ''

  // 2. Recent chapter endings (last 2-3 chapters' final paragraphs for structural continuity)
  let recentEndings = ''
  if (recentChapterContents && recentChapterContents.size > 0) {
    const endings: string[] = []
    for (let i = 1; i <= 3; i++) {
      const content = recentChapterContents.get(chapterNumber - i)
      if (content) {
        const lastPara = extractLastParagraph(content)
        if (lastPara) endings.push(`第${chapterNumber - i}章结尾：${lastPara}`)
      }
    }
    recentEndings = endings.reverse().join('\n')
  }

  // 3. Novel memory — relevance-scored selection
  let characters = ''
  let openThreads = ''
  let foreshadowing = ''
  let relationships = ''
  let arcSummary = ''

  if (novelMemory) {
    // Characters: sort by recency, take top 30
    const sortedChars = novelMemory.characters
      .sort((a, b) => b.lastSeenIn - a.lastSeenIn)
      .slice(0, 30)
    characters = sortedChars.map(c =>
      `- ${c.name}（${c.role}）：${c.currentState}`
    ).join('\n')

    // Open threads: relevance-scored, top 10
    const topThreads = selectTopThreads(novelMemory.openThreads, chapterNumber, 10)
    openThreads = topThreads.map(t =>
      `- ${t.description}（${t.status}，第${t.introducedIn}章引入，最近出现第${t.lastSeenIn}章）`
    ).join('\n')

    // Foreshadowing: relevance-scored, top 8
    const topForeshadowing = selectTopForeshadowing(novelMemory.foreshadowing, chapterNumber, 8)
    foreshadowing = topForeshadowing.map(f =>
      `- ${f.hint}（第${f.chapterIntroduced}章埋下）`
    ).join('\n')

    // Cap to budget
    const allText = [characters, openThreads, foreshadowing].join('\n')
    if (estimateTokens(allText) > MEMORY_BUDGET_TOKENS) {
      const ratio = MEMORY_BUDGET_TOKENS / estimateTokens(allText)
      const maxChars = Math.floor(allText.length * ratio * 0.8)
      characters = characters.slice(0, Math.floor(maxChars * 0.45))
      openThreads = openThreads.slice(0, Math.floor(maxChars * 0.35))
      foreshadowing = foreshadowing.slice(0, Math.floor(maxChars * 0.2))
    }
  }

  // 4. Current arc summary
  const arcIndex = Math.floor((chapterNumber - 1) / 10)
  if (arcIndex < arcMemories.length && arcMemories[arcIndex]) {
    arcSummary = arcMemories[arcIndex].summary
  }

  return {
    previousChapterSummary,
    recentEndings,
    arcSummary,
    characters,
    openThreads,
    foreshadowing,
    relationships,
  }
}

function extractLastParagraph(content: string): string {
  const paragraphs = content.split('\n').map(l => l.trim()).filter(l => l.length > 10)
  const last = paragraphs[paragraphs.length - 1] ?? ''
  return last.length > 80 ? last.slice(0, 77) + '...' : last
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/memory/assemble.ts
git commit -m "feat: add relevance-based memory context assembler with token budget"
```

---

### Task 7: Background Extraction Pipeline

**Files:**
- Create: `src/lib/memory/extract.ts`

- [ ] **Step 1: Create extraction orchestrator**

```typescript
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { createAIProvider } from '@/lib/ai/factory'
import { extractChapterMemory } from './chapter'
import { computeArcMemories } from './arc'
import { computeNovelMemory } from './novel'
import type { ChapterMemoryData, ArcMemoryData, NovelMemoryData } from './types'

const ARC_SIZE = 10

export async function runMemoryExtraction(
  novelId: string,
  chapterNumber: number,
): Promise<void> {
  const novel = await prisma.novel.findUnique({
    where: { id: novelId },
    include: { provider: true },
  })
  if (!novel) return

  let apiKey: string
  try {
    apiKey = decrypt(novel.provider.apiKey)
  } catch {
    console.error('Memory extraction: failed to decrypt API key')
    return
  }

  const aiProvider = createAIProvider({
    baseUrl: novel.provider.baseUrl,
    apiKey,
    model: novel.provider.model,
    type: novel.provider.type,
  })

  // Phase 1: Extract chapter memory (Observer-style)
  const chapter = await prisma.chapter.findUnique({
    where: { novelId_number: { novelId, number: chapterNumber } },
  })
  if (!chapter) return

  let chapterMemoryData: ChapterMemoryData
  try {
    chapterMemoryData = await extractChapterMemory(aiProvider, chapterNumber, chapter.content)
  } catch (e) {
    console.error(`Memory extraction failed for chapter ${chapterNumber}:`, e)
    return
  }

  await prisma.chapterMemory.upsert({
    where: { novelId_chapterNumber: { novelId, chapterNumber } },
    create: {
      novelId,
      chapterNumber,
      summary: chapterMemoryData.summary,
      characters: JSON.stringify(chapterMemoryData.characters),
      threads: JSON.stringify(chapterMemoryData.threads),
      foreshadowing: JSON.stringify(chapterMemoryData.foreshadowing),
      locations: JSON.stringify(chapterMemoryData.locations),
      events: JSON.stringify(chapterMemoryData.events),
      emotions: JSON.stringify(chapterMemoryData.emotions),
      resources: JSON.stringify(chapterMemoryData.resources),
      relationships: JSON.stringify(chapterMemoryData.relationships),
    },
    update: {
      summary: chapterMemoryData.summary,
      characters: JSON.stringify(chapterMemoryData.characters),
      threads: JSON.stringify(chapterMemoryData.threads),
      foreshadowing: JSON.stringify(chapterMemoryData.foreshadowing),
      locations: JSON.stringify(chapterMemoryData.locations),
      events: JSON.stringify(chapterMemoryData.events),
      emotions: JSON.stringify(chapterMemoryData.emotions),
      resources: JSON.stringify(chapterMemoryData.resources),
      relationships: JSON.stringify(chapterMemoryData.relationships),
    },
  })

  // Phase 2: Recompute arc + novel memory (deterministic, no AI cost)
  const allChapterMemories = await prisma.chapterMemory.findMany({
    where: { novelId },
    orderBy: { chapterNumber: 'asc' },
  })

  const parsedChapterMemories = allChapterMemories.map(cm => ({
    chapterNumber: cm.chapterNumber,
    data: parseChapterMemoryJson(cm),
  }))

  const isArcBoundary = chapterNumber % ARC_SIZE === 0
  const isPeriodic = chapterNumber % 5 === 0

  if (isArcBoundary || isPeriodic) {
    const arcs = computeArcMemories(parsedChapterMemories)
    for (let i = 0; i < arcs.length; i++) {
      const arcStart = i * ARC_SIZE + 1
      await prisma.arcMemory.upsert({
        where: { novelId_arcStart: { novelId, arcStart } },
        create: {
          novelId,
          arcStart,
          arcEnd: arcStart + ARC_SIZE - 1,
          summary: arcs[i].summary,
          keyEvents: JSON.stringify(arcs[i].keyEvents),
          activeThreads: JSON.stringify(arcs[i].activeThreads),
        },
        update: {
          summary: arcs[i].summary,
          keyEvents: JSON.stringify(arcs[i].keyEvents),
          activeThreads: JSON.stringify(arcs[i].activeThreads),
        },
      })
    }

    // Recompute novel memory
    const arcMemories = await prisma.arcMemory.findMany({
      where: { novelId },
      orderBy: { arcStart: 'asc' },
    })
    const parsedArcs: ArcMemoryData[] = arcMemories.map(a => ({
      summary: a.summary,
      keyEvents: JSON.parse(a.keyEvents),
      activeThreads: JSON.parse(a.activeThreads),
    }))

    const existingNovelMemory = await prisma.novelMemory.findUnique({
      where: { novelId },
    })
    let existingParsed: NovelMemoryData | null = null
    if (existingNovelMemory) {
      existingParsed = {
        characters: JSON.parse(existingNovelMemory.characters),
        worldRules: JSON.parse(existingNovelMemory.worldRules),
        majorEvents: JSON.parse(existingNovelMemory.majorEvents),
        openThreads: JSON.parse(existingNovelMemory.openThreads),
        foreshadowing: JSON.parse(existingNovelMemory.foreshadowing),
        lastChapterNum: existingNovelMemory.lastChapterNum,
      }
    }

    const novelMemory = computeNovelMemory(parsedChapterMemories, parsedArcs, existingParsed)

    await prisma.novelMemory.upsert({
      where: { novelId },
      create: {
        novelId,
        characters: JSON.stringify(novelMemory.characters),
        worldRules: JSON.stringify(novelMemory.worldRules),
        majorEvents: JSON.stringify(novelMemory.majorEvents),
        openThreads: JSON.stringify(novelMemory.openThreads),
        foreshadowing: JSON.stringify(novelMemory.foreshadowing),
        lastChapterNum: novelMemory.lastChapterNum,
      },
      update: {
        characters: JSON.stringify(novelMemory.characters),
        worldRules: JSON.stringify(novelMemory.worldRules),
        majorEvents: JSON.stringify(novelMemory.majorEvents),
        openThreads: JSON.stringify(novelMemory.openThreads),
        foreshadowing: JSON.stringify(novelMemory.foreshadowing),
        lastChapterNum: novelMemory.lastChapterNum,
      },
    })
  }
}

function parseChapterMemoryJson(cm: {
  summary: string
  characters: string
  threads: string
  foreshadowing: string
  locations: string
  events: string
  emotions: string
  resources: string
  relationships: string
}): ChapterMemoryData {
  return {
    summary: cm.summary,
    characters: JSON.parse(cm.characters),
    threads: JSON.parse(cm.threads),
    foreshadowing: JSON.parse(cm.foreshadowing),
    locations: JSON.parse(cm.locations),
    events: JSON.parse(cm.events),
    emotions: JSON.parse(cm.emotions),
    resources: JSON.parse(cm.resources),
    relationships: JSON.parse(cm.relationships),
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/memory/extract.ts
git commit -m "feat: add background memory extraction pipeline"
```

---

### Task 8: Update Chapter Prompt to Accept Memory Context

**Files:**
- Modify: `src/lib/prompts/chapter.ts`

- [ ] **Step 1: Update getChapterPrompt to accept MemoryContext**

```typescript
import type { MemoryContext } from '@/lib/memory/types'

// ... existing constants and interface unchanged ...

export function getChapterPrompt(
  config: ChapterConfig,
  chapterNumber: number,
  memory?: MemoryContext,
): string {
  let prompt = `请创作小说的第${chapterNumber}章。

小说设定：
- 类型：${config.genre}
- 频道：${TARGET_LABELS[config.target] ?? config.target}
- 篇幅：${WORD_COUNT_LABELS[config.wordCount] ?? config.wordCount}
- 风格：${config.style}
- 视角：${config.pov}
- 背景：${config.background === '自定义' ? config.backgroundCustom : config.background}`

  if (config.protagonist) {
    prompt += `\n- 主角设定：${config.protagonist}`
  }
  if (config.conflict) {
    prompt += `\n- 核心冲突：${config.conflict}`
  }
  if (config.customNote) {
    prompt += `\n- 补充说明：${config.customNote}`
  }

  if (chapterNumber === 1) {
    prompt += `\n\n这是小说的第一章。请从头开始创作，建立世界观、引入主角和核心冲突。`
  } else if (memory) {
    prompt += `\n\n【上下文信息——请务必基于以下信息保持连贯性】`

    if (memory.previousChapterSummary) {
      prompt += `\n\n上一章概要：\n${memory.previousChapterSummary}`
    }

    if (memory.recentEndings) {
      prompt += `\n\n近期章节结尾（注意避免结构重复）：\n${memory.recentEndings}`
    }

    if (memory.arcSummary) {
      prompt += `\n\n当前篇章概要：\n${memory.arcSummary}`
    }

    if (memory.characters) {
      prompt += `\n\n出场人物状态：\n${memory.characters}`
    }

    if (memory.openThreads) {
      prompt += `\n\n未完结剧情线（请妥善推进或回收）：\n${memory.openThreads}`
    }

    if (memory.foreshadowing) {
      prompt += `\n\n待回收伏笔：\n${memory.foreshadowing}`
    }

    prompt += `\n\n请在此基础上继续创作，保持情节连贯，人物行为一致，妥善推进或回收以上剧情线和伏笔。`
  }

  prompt += `\n\n请直接输出章节内容，格式为"第${chapterNumber}章：标题"，然后是正文。`

  return prompt
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/prompts/chapter.ts
git commit -m "feat: update chapter prompt to accept memory context"
```

---

### Task 9: Integrate Memory into Generate Route

**Files:**
- Modify: `src/app/api/novels/[id]/generate/route.ts`

- [ ] **Step 1: Add memory loading and background extraction to generate route**

Changes:
1. Load ChapterMemories, ArcMemories, NovelMemory when chapter > 1
2. Load recent chapter contents for endings
3. Call `assembleMemoryContext()` → pass to `getChapterPrompt()`
4. After chapter save: fire-and-forget `runMemoryExtraction()`

```typescript
// Add imports:
import { assembleMemoryContext } from '@/lib/memory/assemble'
import { runMemoryExtraction } from '@/lib/memory/extract'
import type { ChapterMemoryData, ArcMemoryData, MemoryContext } from '@/lib/memory/types'

// Inside POST handler, after config assembly, before chapterPrompt:

let memoryContext: MemoryContext | undefined
if (nextChapterNumber > 1) {
  const [chapterMems, arcMems, novelMem, recentChapters] = await Promise.all([
    prisma.chapterMemory.findMany({
      where: { novelId: id },
      orderBy: { chapterNumber: 'asc' },
    }),
    prisma.arcMemory.findMany({
      where: { novelId: id },
      orderBy: { arcStart: 'asc' },
    }),
    prisma.novelMemory.findUnique({
      where: { novelId: id },
    }),
    prisma.chapter.findMany({
      where: { novelId: id, number: { gte: nextChapterNumber - 3, lt: nextChapterNumber } },
      select: { number: true, content: true },
    }),
  ])

  const chapterMemoryMap = new Map<number, ChapterMemoryData>()
  for (const cm of chapterMems) {
    chapterMemoryMap.set(cm.chapterNumber, {
      summary: cm.summary,
      characters: JSON.parse(cm.characters),
      threads: JSON.parse(cm.threads),
      foreshadowing: JSON.parse(cm.foreshadowing),
      locations: JSON.parse(cm.locations),
      events: JSON.parse(cm.events),
      emotions: JSON.parse(cm.emotions),
      resources: JSON.parse(cm.resources),
      relationships: JSON.parse(cm.relationships),
    })
  }

  const arcMemories: ArcMemoryData[] = arcMems.map(a => ({
    summary: a.summary,
    keyEvents: JSON.parse(a.keyEvents),
    activeThreads: JSON.parse(a.activeThreads),
  }))

  const novelMemoryData = novelMem ? {
    characters: JSON.parse(novelMem.characters),
    worldRules: JSON.parse(novelMem.worldRules),
    majorEvents: JSON.parse(novelMem.majorEvents),
    openThreads: JSON.parse(novelMem.openThreads),
    foreshadowing: JSON.parse(novelMem.foreshadowing),
    lastChapterNum: novelMem.lastChapterNum,
  } : null

  const recentChapterContents = new Map<number, string>()
  for (const ch of recentChapters) {
    recentChapterContents.set(ch.number, ch.content)
  }

  memoryContext = assembleMemoryContext(
    nextChapterNumber,
    chapterMemoryMap,
    arcMemories,
    novelMemoryData,
    recentChapterContents,
  )
}

const chapterPrompt = getChapterPrompt(config, nextChapterNumber, memoryContext)

// ... after chapter save (prisma.chapter.create) ...

// Fire-and-forget background memory extraction
runMemoryExtraction(id, nextChapterNumber).catch(err => {
  console.error('Background memory extraction failed:', err)
})
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/novels/[id]/generate/route.ts
git commit -m "feat: integrate memory system into chapter generation"
```

---

### Task 10: Integrate Memory into Regenerate Route

**Files:**
- Modify: `src/app/api/novels/[id]/chapters/[num]/regenerate/route.ts`

- [ ] **Step 1: Add same memory loading to regenerate route**

Apply the same memory loading logic as Task 9. The regenerate route needs to:
1. Load memory context for the chapter being regenerated
2. Pass it to `getChapterPrompt()`
3. Fire-and-forget `runMemoryExtraction()` after save

- [ ] **Step 2: Commit**

```bash
git add src/app/api/novels/[id]/chapters/[num]/regenerate/route.ts
git commit -m "feat: integrate memory system into chapter regeneration"
```

---

### Task 11: Verification

- [ ] **Step 1: TypeScript type check**

```bash
npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Manual test flow**

1. Start dev server: `npm run dev`
2. Create a new novel and generate chapter 1
3. Verify: `chapter_memories` table has a row for chapter 1 (background extraction)
4. Generate chapter 2
5. Verify: generation prompt includes "上一章概要" from chapter 1's memory
6. Generate chapters 3-10 to trigger arc memory creation
7. Verify: `arc_memories` table has a row for arc 1-10
8. Generate chapter 11
9. Verify: prompt includes arc summary, character list, open threads, and recent endings

---

## How It Works for 1M+ Character Novels

| Chapters | Context Provided to AI | Token Cost |
|----------|----------------------|------------|
| 1 | None (fresh start) | 0 |
| 2-5 | Previous chapter summary (~150 chars) | ~300 tokens |
| 6-10 | Prev summary + recent endings | ~800 tokens |
| 11-20 | Prev summary + recent endings + arc summary + top characters | ~1500 tokens |
| 21-50 | + relevance-scored threads & foreshadowing | ~2500 tokens |
| 50+ | Same structure, token budget capping at 3000 | ~3000 tokens max |

The AI never sees raw chapter content. It sees structured, compressed, relevance-scored summaries. A 100-chapter novel's entire memory context fits in ~3000 tokens.

## InkOS vs Our Approach

| Aspect | InkOS | Our System |
|--------|-------|------------|
| Storage | 7 Markdown files + SQLite | PostgreSQL (3 tables) |
| Fact extraction | Observer agent (9 dimensions) | Observer-style AI extraction (9 dimensions) |
| State update | Reflector → JSON delta | Deterministic merge (no AI cost for arc/novel) |
| Memory retrieval | Relevance-scored selection | Relevance-scored selection (same concept) |
| Context injection | Compose → ContextPackage | assembleMemoryContext → MemoryContext |
| Audit | 33-dimension continuity auditor | Not included (future enhancement) |
| Pipeline | Write → Observe → Reflect → Audit → Revise | Write → Stream → Background Extract |
