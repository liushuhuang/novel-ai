import type { SpotFixPatch } from './types'

/** 最大补丁改动比例 — 超过 25% 则拒绝所有补丁 */
const MAX_SPOT_FIX_TOUCHED_RATIO = 0.25

/**
 * 解析 Reviser 输出的 TARGET_TEXT / REPLACEMENT_TEXT 补丁
 *
 * 支持格式：
 * TARGET_TEXT: <原文片段>
 * REPLACEMENT_TEXT: <替换内容>
 */
export function parseSpotFixPatches(output: string): SpotFixPatch[] {
  const patches: SpotFixPatch[] = []

  // 统一换行符
  const normalized = output.replace(/\r\n/g, '\n')

  // 匹配 TARGET_TEXT / REPLACEMENT_TEXT 对
  const pairRegex = /TARGET_TEXT\s*[:：]\s*\n([\s\S]*?)\n\s*REPLACEMENT_TEXT\s*[:：]\s*\n([\s\S]*?)(?=\n\s*TARGET_TEXT\s*[:：]|\n\s*---|\n\s*$|$)/g

  let match: RegExpExecArray | null
  while ((match = pairRegex.exec(normalized)) !== null) {
    const targetText = match[1].trim()
    const replacementText = match[2].trim()
    if (targetText) {
      patches.push({ targetText, replacementText })
    }
  }

  // 如果上面的多行格式没匹配到，尝试单行格式
  if (patches.length === 0) {
    const singleLineRegex = /TARGET_TEXT\s*[:：]\s*"([\s\S]*?)"\s*\n?\s*REPLACEMENT_TEXT\s*[:：]\s*"([\s\S]*?)"/g
    while ((match = singleLineRegex.exec(normalized)) !== null) {
      const targetText = match[1].trim()
      const replacementText = match[2].trim()
      if (targetText) {
        patches.push({ targetText, replacementText })
      }
    }
  }

  return patches
}

/**
 * 将补丁应用到原文
 *
 * 安全校验：
 * - 每个 TARGET_TEXT 必须在原文中恰好匹配一次
 * - 总改动量不超过原文的 25%
 */
export function applySpotFixPatches(
  originalContent: string,
  patches: SpotFixPatch[],
): { content: string; applied: number; rejected: number } {
  if (patches.length === 0) {
    return { content: originalContent, applied: 0, rejected: 0 }
  }

  let content = originalContent
  let totalTouchedChars = 0
  let applied = 0
  let rejected = 0

  for (const patch of patches) {
    // 检查 target 是否恰好出现一次
    const indices = findAllOccurrences(content, patch.targetText)
    if (indices.length !== 1) {
      rejected++
      continue
    }

    // 检查改动量
    totalTouchedChars += patch.targetText.length
    if (totalTouchedChars / originalContent.length > MAX_SPOT_FIX_TOUCHED_RATIO) {
      rejected++
      continue
    }

    // 应用补丁
    content = content.replace(patch.targetText, patch.replacementText)
    applied++
  }

  return { content, applied, rejected }
}

function findAllOccurrences(text: string, target: string): number[] {
  const indices: number[] = []
  let pos = 0
  while ((pos = text.indexOf(target, pos)) !== -1) {
    indices.push(pos)
    pos += 1
  }
  return indices
}
