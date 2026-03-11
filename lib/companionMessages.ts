/**
 * 任务完成陪伴文案库（30 条）
 * 占位符：{taskName}、{completedCount}、{energyLeft}
 */
export const COMPANION_MESSAGES: string[] = [
  "{taskName} 搞定，比预期省了点力气，手感不错",
  "这次 {taskName} 的节奏挺稳的，效率在线",
  "{taskName} ✓ 有时候就是得一口气做完才顺",
  "{taskName} 花的力气比预想多，正常，难的事就是这样",
  "刚才 {taskName} 消耗有点大，喝口水，动一动",
  "{taskName} 做完了，身体比你先知道该缓一缓了",
  "{taskName} 完成，今天又往前推了一块",
  "一个一个来，{taskName} 已经不用再想了",
  "{taskName} 打掉了，清单又短了一行",
  "连续脑力任务之后搞定了 {taskName}，接下来可以换个轻一点的",
  "{taskName} 之后，如果精力不到50%，优先排体力或休息",
  "体力任务完了接脑力，精力回来得快，{taskName} 是个好例子",
  "{taskName} 完成了，不管过程怎样，你今天在认真对待自己",
  "做完 {taskName} 这件事，就值得被好好对待一下",
  "有些任务不容易开始，{taskName} 你还是做了",
  "{taskName}，搞定，下一个",
  "实际精力和预计对上了？{taskName} 你已经很了解自己了",
  "{taskName} 完成，今天的你挺能打的",
  "{taskName} 完成，今天第{completedCount}个任务，精力还剩{energyLeft}%",
  "精力还有{energyLeft}%，{taskName}之后还有余量",
  "{taskName} done，完成率在提升",
  "脑力任务{taskName}完了，20分钟后精力会回来一些",
  "{taskName}这类任务，下次可以安排在精力高峰期，效果更好",
  "完成{taskName}的经验值+1，下次预估会更准",
  "{taskName} 完成，今天状态怎么样？",
  "不管{taskName}结果如何，开始和完成都需要勇气",
  "{taskName}做完了，给自己一点肯定",
  "{taskName} 收尾了，休息一下再继续",
  "又一项 {taskName} 划掉，进度感拉满",
  "{taskName} 完成，小步快跑，稳",
];

export function pickRandomCompanionMessage(params: {
  taskName: string;
  completedCount?: number;
  energyLeft?: number;
}): string {
  const msg = COMPANION_MESSAGES[Math.floor(Math.random() * COMPANION_MESSAGES.length)];
  return msg
    .replace(/\{taskName\}/g, params.taskName)
    .replace(/\{completedCount\}/g, String(params.completedCount ?? "—"))
    .replace(/\{energyLeft\}/g, String(params.energyLeft ?? "—"));
}
