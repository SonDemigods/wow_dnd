import { test, expect } from '@playwright/test';
import {
  setupCharacterInGame,
  enterFirstZone,
  runCmd,
  closePopup,
  readGold
} from './helpers';

/**
 * 用例4：任务系统
 *
 * 流程：打开任务板 → 接取任务 → 击杀目标敌人 → 交付任务 → 领取奖励
 *
 * 实现说明：
 * - enterFirstZone 进入第一个 unlocked 区域（azuremyst，蓝晶岛）
 * - 该区域的任务 'azuremyst_gnolls'（强盗窝点）需击杀 3 只 gnoll，奖励 50 经验 + 25 金币
 * - 接取通过 cmd.quests('accept') 完成（保证 questId 可控），交付通过 UI 点击 .claim-btn
 * - 击杀通过 cmd.spawn('gnoll') + cmd.kill 循环完成（cmd.spawn 不会显示 CombatPopup，
 *   但会进入战斗状态，cmd.kill 触发 endCombat('victory') → onEnemyKilled 推进任务进度）
 * - 任务进度达成 3/3 后自动完成（_handleQuestCompletion 发放奖励，状态转为 completed）
 * - UI 交付（.claim-btn）将状态从 completed → turned_in
 */
test.describe('任务系统', () => {
  test('接取任务并完成交付领取奖励', async ({ page }) => {
    await setupCharacterInGame(page, 'Quest');
    await enterFirstZone(page);
    await expect(page.getByText(/探索进度/)).toBeVisible();

    // 记录初始金币（任务奖励 25 金币 + 击杀掉落金币）
    const goldBefore = await readGold(page);

    // 1. 打开任务板（.cell.board 固定在网格角落，初始已探索）
    const boardCell = page.locator('.cell.board').first();
    await expect(boardCell).toBeVisible();
    await boardCell.dispatchEvent('mousedown', { button: 0, bubbles: true, clientX: 0, clientY: 0 });
    await boardCell.dispatchEvent('mouseup', { button: 0, bubbles: true, clientX: 0, clientY: 0 });

    // 验证任务板弹窗渲染
    await expect(page.locator('.quest-tabs')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/可接取任务/)).toBeVisible();
    await expect(page.getByText(/可交付任务/)).toBeVisible();

    // 关闭任务板（任务定义已通过 onMounted 的 loadQuests() 加载到 questStore）
    await closePopup(page);
    await page.waitForTimeout(300);

    // 2. 通过 cmd 接取 'azuremyst_gnolls' 任务（杀 3 只 gnoll）
    const acceptResult = await runCmd(page, 'quests', 'accept', 'azuremyst_gnolls');
    expect(acceptResult.success).toBeTruthy();
    expect(acceptResult.message).toContain('已接受任务');
    await page.waitForTimeout(300);

    // 3. 循环击杀 3 只 gnoll 推进任务进度
    // cmd.spawn('gnoll') 创建敌人并进入战斗（不显示 CombatPopup）
    // cmd.kill 击杀当前目标并 endCombat('victory')，触发 onEnemyKilled('gnoll')
    // onEnemyKilled 是 fire-and-forget，进度更新异步完成
    for (let i = 0; i < 3; i++) {
      const spawnResult = await runCmd(page, 'spawn', 'gnoll');
      expect(spawnResult.success).toBeTruthy();
      await page.waitForTimeout(200);

      const killResult = await runCmd(page, 'kill');
      expect(killResult.success).toBeTruthy();
      expect(killResult.message).toContain('已被消灭');
      await page.waitForTimeout(200);
    }

    // 等待任务进度更新和自动完成（onEnemyKilled 异步，需等待 Vue 响应式更新）
    await page.waitForTimeout(800);

    // 验证任务奖励已在完成时发放（金币增加，包含击杀掉落 + 任务奖励 25 金币）
    const goldAfterKills = await readGold(page);
    expect(goldAfterKills).toBeGreaterThan(goldBefore);

    // 4. 重新打开任务板，切换到"可交付"标签
    await boardCell.dispatchEvent('mousedown', { button: 0, bubbles: true, clientX: 0, clientY: 0 });
    await boardCell.dispatchEvent('mouseup', { button: 0, bubbles: true, clientX: 0, clientY: 0 });
    await expect(page.locator('.quest-tabs')).toBeVisible({ timeout: 5000 });

    // 切换到"可交付任务"标签
    await page.getByRole('button', { name: '可交付任务' }).click();
    await page.waitForTimeout(500);

    // 验证可交付任务卡片存在（任务已自动完成，status=completed）
    const turnInCard = page.locator('.quest-card.turnin').first();
    await expect(turnInCard).toBeVisible({ timeout: 5000 });

    // 5. 点击"交付"按钮提交任务（状态从 completed → turned_in）
    const claimBtn = page.locator('.claim-btn').first();
    await expect(claimBtn).toBeVisible();
    await claimBtn.click();
    await page.waitForTimeout(500);

    // 验证交付成功：可交付任务卡片消失
    const remainingTurnIn = await page.locator('.quest-card.turnin').count();
    expect(remainingTurnIn).toBe(0);

    // 关闭任务板，验证返回游戏界面
    await closePopup(page);
    await page.waitForTimeout(300);
    await expect(page.getByRole('button', { name: /系统/ })).toBeVisible();
  });
});
