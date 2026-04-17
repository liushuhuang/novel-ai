# Novel AI

AI 驱动的长篇小说自动生成平台，支持多供应商、流式生成、3 层记忆系统。

## 技术栈

| 层面 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router, RSC) |
| 语言 | TypeScript 5 (strict mode) |
| UI | React 19 + Tailwind CSS v4 + shadcn/ui + Lucide Icons |
| 表单 | react-hook-form + zod 校验 |
| 数据库 | PostgreSQL + Prisma 7 ORM (PrismaPg adapter) |
| AI 集成 | OpenAI SDK / Anthropic SDK / Google Generative AI SDK / 自定义接口 |
| 流式传输 | SSE (Server-Sent Events) |
| 安全 | AES-256-GCM 加密 API Key，内存级限流 (20 req/min/IP) |

## 项目结构

```
novel-ai/
├── prisma/
│   ├── schema.prisma              # 数据库模型定义 (6 张表)
│   └── migrations/                # 数据库迁移文件
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── novels/            # 小说 CRUD + 生成
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── route.ts           # GET/PATCH 单个小说
│   │   │   │   │   ├── generate/route.ts  # POST 生成下一章 (SSE)
│   │   │   │   │   └── chapters/
│   │   │   │   │       └── [num]/
│   │   │   │   │           └── regenerate/route.ts  # POST 重新生成
│   │   │   │   └── route.ts      # GET 列表 / POST 创建
│   │   │   └── providers/        # AI 供应商 CRUD + 测试
│   │   ├── novels/               # 小说列表 / 创建向导 / 阅读页
│   │   ├── settings/providers/   # 供应商管理页
│   │   └── page.tsx              # 首页
│   ├── components/
│   │   ├── ui/                   # shadcn/ui 基础组件
│   │   ├── novels/               # 小说相关组件 (wizard, chapter-list, streaming-text, edit-dialog)
│   │   └── providers/            # 供应商相关组件 (form, card)
│   ├── lib/
│   │   ├── ai/                   # AI 供应商适配器 (openai/claude/gemini/custom)
│   │   ├── memory/               # 3 层记忆系统
│   │   │   ├── types.ts          # 核心类型定义
│   │   │   ├── chapter.ts        # Observer 提示词 — AI 提取章节事实
│   │   │   ├── extract.ts        # 提取管道编排
│   │   │   ├── arc.ts            # 篇章记忆计算 (每 10 章)
│   │   │   ├── novel.ts          # 全局记忆聚合
│   │   │   └── assemble.ts       # 记忆上下文组装 (3000 token 预算)
│   │   ├── prompts/              # 提示词系统
│   │   │   ├── system.ts         # 系统提示词 (21 条写作铁律)
│   │   │   ├── chapter.ts        # 章节生成提示词
│   │   │   ├── title.ts          # 标题生成提示词
│   │   │   ├── anti-ai.ts        # 反 AI 味道对照表
│   │   │   └── genre-rules.ts    # 8 种类型的专属写作规范
│   │   ├── db.ts                 # Prisma 客户端单例
│   │   ├── crypto.ts             # AES-256-GCM 加解密
│   │   └── rate-limit.ts         # 限流器
│   └── types/                    # 共享类型 (ai, provider, novel)
└── .env                          # 环境变量
```

## 数据库模型

```
Provider (1) ──→ (N) Novel
Novel (1) ──→ (N) Chapter
Novel (1) ──→ (N) ChapterMemory
Novel (1) ──→ (N) ArcMemory
Novel (1) ──→ (1) NovelMemory
```

| 模型 | 说明 |
|------|------|
| `Provider` | AI 供应商配置（名称、类型、API 地址、密钥、模型） |
| `Novel` | 小说元数据（标题、类型、风格、视角、背景等） |
| `Chapter` | 章节内容（编号、标题、正文、字数） |
| `ChapterMemory` | 章节记忆（9 维度事实提取：角色、剧情线、伏笔、地点、事件、情绪、资源、关系、回收伏笔） |
| `ArcMemory` | 篇章记忆（每 10 章汇总：概要、关键事件、活跃剧情线） |
| `NovelMemory` | 全局记忆（角色表、世界观规则、重大事件、未完结剧情线、伏笔追踪） |

## 核心流程

```
用户创建小说 (选择供应商 + 设置参数)
        │
        ▼
  ┌─ 生成第 N 章 ──────────────────────────────────┐
  │                                                  │
  │  1. 加载记忆上下文 (N > 1 时)                     │
  │     ├── ChapterMemory (全部章节)                  │
  │     ├── ArcMemory (按篇章)                        │
  │     ├── NovelMemory (全局)                        │
  │     └── 近 3 章原文 (防重复结尾)                   │
  │                                                  │
  │  2. 组装提示词                                    │
  │     ├── System Prompt (21 条铁律)                 │
  │     └── Chapter Prompt                            │
  │         ├── 小说设定 (类型/风格/背景等)             │
  │         ├── 类型专属写作规范                       │
  │         ├── 反 AI 味道对照表                       │
  │         ├── 记忆上下文 (3000 token 预算)           │
  │         └── 格式要求                              │
  │                                                  │
  │  3. 调用 AI 供应商接口 (SSE 流式返回)              │
  │                                                  │
  │  4. 保存章节到数据库                              │
  │                                                  │
  │  5. 后台记忆提取 (fire-and-forget)                 │
  │     ├── Observer AI → 9 维度事实 JSON             │
  │     ├── 存入 ChapterMemory                        │
  │     └── 每 5-10 章重新计算 Arc + Novel 记忆       │
  │                                                  │
  └──────────────────────────────────────────────────┘
```

### 3 层记忆系统

```
第 1 层: ChapterMemory (AI 提取)
  每章生成后，Observer AI 从正文中提取 9 个维度的结构化事实
  角色行为 / 位置变化 / 资源变化 / 关系变化 / 情绪变化 /
  信息流动 / 剧情线索 / 伏笔回收 / 身体状态

        │  每 5-10 章
        ▼
第 2 层: ArcMemory (确定性计算)
  每 10 章为一个篇章，汇总章节摘要、关键事件、活跃剧情线

        │  与第 2 层同步
        ▼
第 3 层: NovelMemory (确定性计算)
  聚合所有信息：角色表、世界规则、重大事件、未完结剧情线、伏笔生命周期
  伏笔支持压力评分 — 越老的未回收伏笔优先级越高
```

### 生成提示词架构

```
System Prompt
├── 21 条写作铁律
│   ├── 禁止真实公司/国家/人物名称 (架空世界)
│   ├── 禁止替读者下结论
│   ├── 禁止"不是A而是B"句式
│   ├── 禁止破折号
│   ├── 限制惊讶词频率 (每 3000 字 ≤ 1 次)
│   └── ...更多反 AI 规则
│
Chapter Prompt
├── 小说设定 (类型/频道/篇幅/风格/视角/背景)
├── 类型专属写作规范 (8 种类型各有不同要求)
├── 反 AI 味道对照表 (反例→正例)
├── 记忆上下文
│   ├── 上一章概要
│   ├── 近期章节结尾
│   ├── 篇章概要
│   ├── 人物状态
│   ├── 未完结剧情线
│   ├── 待回收伏笔 (含压力标记)
│   └── 近期已回收伏笔
└── 格式要求 + 强调限制
```

## 从 0 开始运行

### 环境要求

- **Node.js** >= 20
- **PostgreSQL** >= 14
- **npm** (或 pnpm / yarn)

### 步骤

**1. 克隆项目并安装依赖**

```bash
git clone git@github.com:liushuhuang/novel-ai.git
cd novel-ai
npm install
```

**2. 创建 PostgreSQL 数据库**

```bash
psql -U postgres -c "CREATE DATABASE novel_ai;"
```

**3. 配置环境变量**

```bash
cp .env.example .env
```

编辑 `.env`，填入实际值：

```env
# PostgreSQL 连接串，修改用户名和密码
DATABASE_URL=postgresql://postgres:你的密码@localhost:5432/novel_ai

# 32 位随机字符串，用于加密存储的 API Key
# 可用命令生成: node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
ENCRYPTION_KEY=你的32位加密密钥

NODE_ENV=development
```

**4. 初始化数据库**

```bash
# 执行所有迁移，创建表结构
npx prisma migrate deploy

# 生成 Prisma Client
npx prisma generate
```

**5. 启动开发服务器**

```bash
npm run dev
```

浏览器打开 http://localhost:3000

**6. 开始使用**

1. 进入「供应商管理」，添加 AI 供应商（OpenAI / Claude / Gemini / 自定义接口）
2. 点击「测试连接」确认供应商可用
3. 进入「创建小说」，设置类型、风格等参数
4. 点击「生成第 1 章」开始创作

### 生产构建

```bash
npm run build
npm start
```

## API 供应商

支持 4 种供应商类型：

| 类型 | 说明 | SDK |
|------|------|-----|
| `openai-compatible` | OpenAI 及兼容接口 | openai |
| `claude` | Anthropic Claude | @anthropic-ai/sdk |
| `gemini` | Google Gemini | @google/generative-ai |
| `custom` | 自定义 OpenAI 兼容接口 | fetch (原生) |

所有 API Key 使用 AES-256-GCM 加密后存储在数据库中。
