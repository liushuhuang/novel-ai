/** LLM 可调用的工具定义 */
export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required: string[]
  }
}

/** LLM 发出的工具调用 */
export interface ToolCallBlock {
  id: string
  name: string
  arguments: string // JSON string
}

/** 流式事件的判别联合类型 */
export type StreamEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; toolCall: ToolCallBlock }
