import type { CadenceAnalysis } from './types'

// 高张力情绪关键词
const HIGH_TENSION_MOODS = [
  '紧张', '压抑', '激烈', '冲突', '愤怒', '恐惧', '绝望', '危机',
  '危险', '冷硬', '暴怒', '惨烈', '生死', '杀意',
]

// 场景类型关键词映射
const SCENE_TYPE_KEYWORDS: Record<string, string[]> = {
  '会议/汇报': ['晨会', '会议', '汇报', '会议室', '投影', '议程'],
  '日常/办公': ['办公室', '工位', '茶水间', '前台', '格子间', '办公'],
  '外勤/现场': ['现场', '工地', '拆迁', '南城', '街道', '户外', '外勤'],
  '私人/情感': ['医务室', '咖啡馆', '家里', '卧室', '阳台', '客厅', '私人'],
  '冲突/对峙': ['对峙', '争吵', '翻脸', '质问', '威胁', '争论', '吵架'],
  '回忆/闪回': ['回忆', '曾经', '当年', '往事', '闪回', '记忆'],
  '训练/战斗': ['训练', '战斗', '比武', '修炼', '实战', '比赛'],
}

/** 纯规则节奏分析 */
export function analyzeCadence(
  recentMemories: Array<{
    chapterNumber: number
    summary: string
    events: string
    locations: string
  }>,
): CadenceAnalysis {
  const summaries = recentMemories.map(m => {
    let summary = ''
    try {
      summary = JSON.parse(m.summary || '""')
    } catch {
      summary = m.summary || ''
    }
    return {
      chapterNumber: m.chapterNumber,
      summary,
      events: m.events,
      locations: m.locations,
    }
  })

  // 场景类型分析
  const sceneTypes = summaries.map(s => classifySceneType(s.summary, s.locations))
  const sceneStreak = countTrailingStreak(sceneTypes)
  const scenePressure = resolvePressure(sceneStreak, sceneTypes.length)

  // 情绪基调分析
  const moods = summaries.map(s => classifyMood(s.summary))
  const moodStreak = countTrailingHighTensionStreak(moods)
  const moodPressure = resolvePressure(moodStreak, moods.length)

  // 重复描写检测
  const repeatedPatterns = detectRepeatedPatterns(summaries.map(s => s.summary))

  return {
    recentSceneTypes: sceneTypes,
    sceneStreak,
    scenePressure,
    recentMoods: moods,
    moodStreak,
    moodPressure,
    repeatedPatterns,
  }
}

function classifySceneType(summary: string, locationsJson: string): string {
  let locations: string[] = []
  try {
    locations = JSON.parse(locationsJson || '[]')
  } catch {
    // ignore
  }

  const text = summary + ' ' + locations.join(' ')

  for (const [type, keywords] of Object.entries(SCENE_TYPE_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) return type
  }
  return '其他'
}

function classifyMood(summary: string): string {
  if (HIGH_TENSION_MOODS.some(kw => summary.includes(kw))) return '高张力'
  if (summary.includes('轻松') || summary.includes('温馨') || summary.includes('幽默')) return '轻松'
  if (summary.includes('平静') || summary.includes('日常')) return '日常'
  return '中性'
}

function countTrailingStreak(items: string[]): number {
  if (items.length === 0) return 0
  let streak = 1
  const last = items[items.length - 1]
  for (let i = items.length - 2; i >= 0; i--) {
    if (items[i] === last) streak++
    else break
  }
  return streak
}

function countTrailingHighTensionStreak(moods: string[]): number {
  if (moods.length === 0) return 0
  let streak = 0
  for (let i = moods.length - 1; i >= 0; i--) {
    if (moods[i] === '高张力') streak++
    else break
  }
  return streak
}

function resolvePressure(streak: number, total: number): 'none' | 'medium' | 'high' {
  if (streak >= 3) return 'high'
  if (streak >= 2 && total >= 3) return 'medium'
  return 'none'
}

/** 检测重复描写模式（提取高频双字词） */
function detectRepeatedPatterns(summaries: string[]): string[] {
  const patterns: string[] = []
  const allText = summaries.join('')

  const bigrams = new Map<string, number>()
  for (let i = 0; i < allText.length - 1; i++) {
    const bg = allText.slice(i, i + 2)
    if (/[\u4e00-\u9fa5]{2}/.test(bg)) {
      bigrams.set(bg, (bigrams.get(bg) || 0) + 1)
    }
  }

  for (const [bg, count] of bigrams) {
    if (count >= 4) patterns.push(`"${bg}"出现${count}次`)
  }

  return patterns.slice(0, 3)
}
