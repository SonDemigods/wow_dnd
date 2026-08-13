import type { Page, Locator } from '@playwright/test';

/**
 * E2E 测试公共辅助函数
 *
 * 选择器策略：项目未使用 data-testid，统一使用 getByText / getByRole / CSS class。
 * 角色创建流程为 4 步：阵营 → 种族 → 职业 → 名字 → 确认弹窗。
 */

/** 角色名前缀，避免不同测试间名称冲突 */
const CHAR_NAME_PREFIX = 'E2E';

/**
 * 生成唯一角色名
 */
export function makeCharName(seed: string): string {
  return `${CHAR_NAME_PREFIX}${seed}${Date.now().toString().slice(-5)}`;
}

/**
 * 等待应用加载完成（loading 屏消失，角色选择界面出现）
 */
export async function waitForAppReady(page: Page): Promise<void> {
  await page.goto('/');
  // 标题出现表示角色选择界面已渲染
  await page.getByRole('heading', { name: '战争艺术：地下城' }).waitFor({ state: 'visible' });
}

/**
 * 打开角色创建弹窗
 */
export async function openCreateModal(page: Page): Promise<void> {
  await page.locator('.add-character').click();
  // 等待创建弹窗渲染：顶部步骤标题
  await page.getByText(/步骤 1\/4/).waitFor({ state: 'visible' });
}

/**
 * 完成角色创建的 4 步流程并返回角色选择界面
 *
 * @param page 浏览器页面对象
 * @param name 角色名
 */
export async function createCharacter(page: Page, name: string): Promise<void> {
  await openCreateModal(page);

  // 步骤 1：选择第一个阵营（排除中立后取第一个，若仅中立则取中立）
  const factionCards = page.locator('.faction-card');
  await factionCards.first().click();
  await clickNext(page);

  // 步骤 2：选择第一个种族
  await page.locator('.race-card').first().click();
  await clickNext(page);

  // 步骤 3：选择第一个职业
  await page.locator('.class-card').first().click();
  await clickNext(page);

  // 步骤 4：输入角色名并创建
  await page.locator('.name-input').fill(name);
  await page.getByRole('button', { name: '创建角色', exact: true }).click();

  // 确认弹窗 → 点击"确认创建"
  await page.getByRole('heading', { name: '确认创建角色' }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: '确认创建' }).click();

  // 等待弹窗关闭，回到角色选择界面（创建按钮再次可见）
  await page.getByText('创建角色', { exact: true }).first().waitFor({ state: 'visible' });
}

/** 点击"下一步"按钮 */
async function clickNext(page: Page): Promise<void> {
  await page.getByRole('button', { name: '下一步' }).click();
}

/**
 * 选择指定名称的角色并点击"进入游戏"
 *
 * @param page 浏览器页面对象
 * @param name 角色名（可选，不传则选择列表第一个）
 */
export async function selectAndEnterGame(page: Page, name?: string): Promise<void> {
  if (name) {
    // 点击包含角色名的角色卡片
    const card = page.locator('.character-card', { hasText: name });
    await card.first().click();
  } else {
    await page.locator('.character-card').first().click();
  }
  await page.getByRole('button', { name: '进入游戏' }).click();
  // 等待游戏主界面渲染：底部"系统"按钮可见
  await page.getByRole('button', { name: /系统/ }).waitFor({ state: 'visible' });
}

/**
 * 完整前置流程：打开应用 → 创建角色 → 进入游戏
 * 返回创建的角色名
 */
export async function setupCharacterInGame(page: Page, seed: string): Promise<string> {
  await waitForAppReady(page);
  const name = makeCharName(seed);
  await createCharacter(page, name);
  await selectAndEnterGame(page, name);
  return name;
}

/**
 * 调用 window.cmd 控制台命令
 *
 * 项目在 main.ts 中通过 initConsole() 挂载了 window.cmd 全局对象，
 * 提供 spawn/win/kill/gold/goto 等调试命令。
 *
 * @returns 命令执行结果 { success, message }
 */
export async function runCmd(
  page: Page,
  cmdName: string,
  ...args: (string | number)[]
): Promise<{ success: boolean; message: string }> {
  return page.evaluate(
    ({ cmdName, args }) => {
      const cmd = (window as unknown as { cmd: Record<string, (...a: unknown[]) => Promise<unknown> | unknown> }).cmd;
      if (!cmd || typeof cmd[cmdName] !== 'function') {
        return { success: false, message: `命令不存在: ${cmdName}` };
      }
      return Promise.resolve(cmd[cmdName](...args)) as Promise<{ success: boolean; message: string }>;
    },
    { cmdName, args }
  );
}

/**
 * 从地图进入第一个可解锁区域的探索视图
 *
 * 流程：点击"地图"标签 → 点击第一个 unlocked 区域标记 → 点击"进入探索" → 确认
 */
export async function enterFirstZone(page: Page): Promise<void> {
  // 确保在地图标签
  await page.getByRole('button', { name: /地图/ }).first().click();
  // 点击第一个已解锁的区域标记
  const zone = page.locator('.zone-marker.unlocked').first();
  await zone.click();
  // 点击"进入探索"
  await page.getByRole('button', { name: '进入探索' }).click();
  // 确认弹窗（ConfirmPopup 的确认按钮）
  await page.locator('.popup-footer-btn.confirm').click();
  // 等待探索视图渲染（探索进度文本出现）
  await page.getByText(/探索进度/).waitFor({ state: 'visible' });
}

/**
 * 在探索网格中点击 accessible 格子，直到目标弹窗出现
 *
 * 探索格子类型随机，需循环翻开直到触发目标事件（战斗/商店/任务板）。
 * 注意：ExplorationView 通过 mousedown/mouseup 事件处理点击（拖拽阈值判定），
 * 且格子可能被 .content-tabs 遮挡，因此使用 dispatchEvent 触发事件而非 click。
 *
 * 当非目标弹窗（如战斗）出现时，会自动处理：
 * - 战斗覆盖层（.combat-overlay）：通过 cmd.kill 强制结束并隐藏 DOM，继续探索
 *
 * @param page 浏览器页面对象
 * @param targetSelector 目标弹窗选择器（如 '.combat-overlay' 或 '.shop-content'）
 * @param maxAttempts 最大点击次数
 * @returns 是否成功触发目标弹窗
 */
export async function exploreUntilPopup(
  page: Page,
  targetSelector: string,
  maxAttempts = 40
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    // 已出现目标弹窗则停止
    if (await page.locator(targetSelector).count() > 0) {
      return true;
    }
    // 如果战斗覆盖层出现（且不是目标），强制结束并隐藏以继续探索
    if (targetSelector !== '.combat-overlay') {
      const combatVisible = await page.locator('.combat-overlay').count();
      if (combatVisible > 0) {
        await dismissCombatOverlay(page);
        continue;
      }
    }
    // 取第一个 accessible（可点击的未探索）格子
    const cell = page.locator('.cell.accessible').first();
    if (!(await cell.count())) {
      await page.waitForTimeout(300);
      continue;
    }
    // 通过 dispatchEvent 触发 mousedown + mouseup（模拟无拖动的点击）
    await cell.dispatchEvent('mousedown', { button: 0, bubbles: true, clientX: 0, clientY: 0 });
    await cell.dispatchEvent('mouseup', { button: 0, bubbles: true, clientX: 0, clientY: 0 });
    // 短暂等待弹窗或新格子出现
    try {
      await page.waitForSelector(targetSelector, { timeout: 1500 });
      return true;
    } catch {
      // 未触发目标，继续点击下一个
    }
  }
  return (await page.locator(targetSelector).count()) > 0;
}

/**
 * 强制结束并隐藏战斗覆盖层
 *
 * combatStore.endCombat() 在设置 combatResult 后会立即调用 cleanup() 重置状态，
 * 导致 Vue 响应式批量更新使 .result-overlay（v-if="combatResult"）不会渲染，
 * 战斗弹窗无法通过 UI 正常关闭。
 *
 * 此函数通过 cmd.kill 强制结束战斗，然后隐藏 DOM 覆盖层以恢复底层探索格子可点击。
 * 注意：仅隐藏 DOM，不修改 Vue 组件状态（showCombat 仍为 true），
 * 后续弹窗（如商店）会在上方渲染，不影响功能。
 */
export async function dismissCombatOverlay(page: Page): Promise<void> {
  // 如果仍在战斗中，强制结束
  const inCombat = await page.evaluate(() => {
    const cmd = (window as unknown as { cmd?: Record<string, (...a: unknown[]) => unknown> }).cmd;
    if (!cmd) return false;
    const result = cmd.kill?.([]) as { success?: boolean } | undefined;
    return result?.success ?? false;
  });
  if (inCombat) {
    await page.waitForTimeout(300);
  }
  // 隐藏战斗覆盖层 DOM（不删除，避免 Vue 虚拟 DOM 不一致）
  await page.evaluate(() => {
    const overlay = document.querySelector('.combat-overlay') as HTMLElement | null;
    if (overlay) overlay.style.display = 'none';
  });
  await page.waitForTimeout(200);
}

/**
 * 关闭 BasePopup 弹窗（点击右上角 × 或底部"关闭"按钮）
 */
export async function closePopup(page: Page): Promise<void> {
  const closeBtn = page.locator('.popup-close-btn').first();
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click();
    return;
  }
  const footerClose = page.getByRole('button', { name: '关闭' }).first();
  if (await footerClose.isVisible().catch(() => false)) {
    await footerClose.click();
  }
}

/**
 * 读取当前玩家金币（从 GameMain 头部）
 */
export async function readGold(page: Page): Promise<number> {
  const goldEl = page.locator('.player-gold');
  const text = await goldEl.first().textContent();
  return parseInt((text || '0').replace(/[^\d]/g, ''), 10) || 0;
}

/**
 * 获取探索网格中所有 accessible 格子的 Locator
 */
export function accessibleCells(page: Page): Locator {
  return page.locator('.cell.accessible');
}
