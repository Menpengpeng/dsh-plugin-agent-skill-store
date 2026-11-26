// 增量同步的合并规则。
//
// 核心不变量：**只追加，永不修改、永不删除**。
// 用户的收藏、评分与笔记都挂在 skill.id 上，一旦同步改动了已有条目
// （哪怕只是换了 id），用户的个人数据就会错位。所以这里只认「没见过的
// source::url」才追加，已有条目连一个字段都不碰。

/**
 * 把新抓到的条目并入已有列表。
 * @param {Array} existing 当前数据集里的 skill
 * @param {Array} incoming 本次从 README 解析出的 skill
 * @returns {{added: Array, merged: Array}} added 为新追加的部分，merged 为完整列表
 */
export function mergeNewSkills(existing, incoming) {
  // key 用 source::url 而不是 id：同一 URL 可能对应多个 skill 名，
  // 用 id 会把「同 URL 的新名字」误判成新条目，用 URL 才是真正的「这条链接见过了」
  const seen = new Set(existing.map((s) => `${s.source}::${s.url}`));
  const added = [];
  for (const row of incoming) {
    const key = `${row.source}::${row.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    added.push(row);
  }
  return { added, merged: [...existing, ...added] };
}

/**
 * 判定一次同步的结果状态。
 * - ok：有新增
 * - error：所有来源都没抓成功（不能报「今日无新增」，否则用户以为真的没更新）
 * - empty：抓取正常，确实没有新条目
 * @param {{added:number, failures:string[], totalSources:number}} input
 */
export function syncStatus({ added, failures, totalSources }) {
  const message = failures.length ? failures.join('；') : '';
  if (added > 0) {
    return { status: 'ok', message: failures.length ? `部分来源未取到：${message}` : '' };
  }
  if (totalSources > 0 && failures.length >= totalSources) {
    return { status: 'error', message: `同步失败，${totalSources} 个来源都没能取到内容：${message}` };
  }
  return { status: 'empty', message: failures.length ? `部分来源未取到：${message}` : '' };
}
