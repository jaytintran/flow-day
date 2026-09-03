import { SkillDrill, SkillNodeItem, SkillTreeStats, LEVEL_TITLES, STORAGE_SP_KEY } from './types';
import { UnifiedEntity } from '../../../../types';

// Parse markdown drill tasks from entity content (- [x] Kata 1 or - [ ] Kata 2)
export function parseSkillDrills(content?: string): SkillDrill[] {
  if (!content) return [];
  const lines = content.split('\n');
  const drills: SkillDrill[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]')) {
      const isDone = trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]');
      const title = trimmed.replace(/^-\s*\[[xX ]\]\s*/, '').trim();
      if (title.length > 0) {
        drills.push({
          id: `drill-${index}`,
          title,
          completed: isDone,
        });
      }
    }
  });

  return drills;
}

// Convert drill array back to markdown content string
export function serializeSkillDrills(originalContent: string | undefined, drills: SkillDrill[]): string {
  const lines = (originalContent || '').split('\n');
  const nonDrillLines = lines.filter(
    (line) => !line.trim().startsWith('- [ ]') && !line.trim().startsWith('- [x]') && !line.trim().startsWith('- [X]'),
  );

  const drillLines = drills.map((d) => `- [${d.completed ? 'x' : ' '}] ${d.title}`);
  return [...nonDrillLines, ...drillLines].join('\n').trim();
}

// Calculate total XP and level from tracked hours + drills completed
export function calculateTreeStats(skills: SkillNodeItem[]): SkillTreeStats {
  let totalTimeMs = 0;
  let totalDrills = 0;
  let completedDrills = 0;
  let masteredCount = 0;

  skills.forEach((s) => {
    totalTimeMs += s.time_spent || 0;
    totalDrills += s.drills.length;
    completedDrills += s.drills.filter((d) => d.completed).length;
    if (s.rank >= s.maxRank || s.status === 'mastered') {
      masteredCount++;
    }
  });

  // 1 minute = 10 XP, 1 completed drill = 100 XP
  const minutes = Math.floor(totalTimeMs / 60000);
  const totalXp = minutes * 10 + completedDrills * 100;

  // Level curve: 500 XP per level
  const level = Math.max(1, Math.floor(totalXp / 500) + 1);
  const levelIndex = Math.min(LEVEL_TITLES.length - 1, Math.floor(level / 5));
  const levelTitle = LEVEL_TITLES[levelIndex];

  // 1 SP gained every level, minus stored spent SP
  let spSpentTotal = 0;
  try {
    const raw = localStorage.getItem(STORAGE_SP_KEY);
    if (raw) {
      const map = JSON.parse(raw);
      Object.values(map).forEach((v: any) => {
        spSpentTotal += Number(v) || 0;
      });
    }
  } catch {}

  const availableSp = Math.max(0, level * 2 - spSpentTotal);
  const totalHours = Math.round((totalTimeMs / 3600000) * 10) / 10;
  const masteryPercentage = skills.length > 0 ? Math.round((masteredCount / skills.length) * 100) : 0;

  return {
    totalXp,
    level,
    levelTitle,
    availableSp,
    totalHours,
    masteryPercentage,
  };
}
