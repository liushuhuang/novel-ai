import type { ToolDefinition } from './types'

/** 4 个 agent 工具的定义 */
export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'read_memory',
    description:
      '读取小说的记忆上下文，包括角色状态、未完结剧情线、伏笔池、上一章概要等。在开始写作前调用此工具获取上下文。',
    parameters: {
      type: 'object',
      properties: {
        include_chapter_history: {
          type: 'boolean',
          description:
            '是否包含近期章节内容（最近3章的末尾片段），默认 false',
        },
      },
      required: [],
    },
  },
  {
    name: 'read_chapter',
    description:
      '读取指定章节的完整内容。用于回顾前文细节，确保连贯性。',
    parameters: {
      type: 'object',
      properties: {
        chapter_number: {
          type: 'number',
          description: '要读取的章节编号',
        },
      },
      required: ['chapter_number'],
    },
  },
  {
    name: 'get_writing_progress',
    description:
      '获取当前写作进度：已有章节数、最新章节号、每章概要、记忆提取状态。',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'write_chapter',
    description:
      '保存你创作的章节内容。这是最终的落笔操作，调用后章节将被保存到数据库。格式："第X章：标题\\n\\n正文内容"',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description:
            '完整的章节内容，必须以"第X章：标题"开头，后跟正文',
        },
      },
      required: ['content'],
    },
  },
]
