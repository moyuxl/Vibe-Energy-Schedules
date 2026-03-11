/**
 * 疲劳预警本地 fallback 文案
 * 占位符：{lastTaskName}
 */
export type FatigueTriggerReason = "low_energy" | "continuous_mental" | "energy_overrun";

export const FATIGUE_FALLBACK: Record<FatigueTriggerReason, string[]> = {
  low_energy: [
    "精力到35%了，现在休息15分钟，下午还有得打",
    "快见底了，{lastTaskName}之后先缓一缓",
    "这个点停下来不是放弃，是保存进度",
    "精力值不够用了，强撑效率会更低",
    "充电时间到了，不然后面的任务会更难",
  ],
  continuous_mental: [
    "连续三个脑力任务了，大脑需要换个频道",
    "一直用同一块肌肉会抽筋的，脑子也一样",
    "接下来排个体力或休息，效率会回来",
    "{lastTaskName}做完，该让脑子喘口气了",
    "高强度脑力之后，20分钟的切换比硬撑有用",
  ],
  energy_overrun: [
    "连续两次实际消耗都超预期，任务比想象的难",
    "不是你状态差，是预估需要校准一下",
    "超支不是失败，是数据，下次估高一点",
    "任务难度超预期，适当降低后面的安排",
    "连续超支说明今天的任务密度有点高",
  ],
};

export function pickFatigueFallback(
  reason: FatigueTriggerReason,
  lastTaskName: string
): string {
  const list = FATIGUE_FALLBACK[reason];
  const msg = list[Math.floor(Math.random() * list.length)];
  return msg.replace(/\{lastTaskName\}/g, lastTaskName);
}
