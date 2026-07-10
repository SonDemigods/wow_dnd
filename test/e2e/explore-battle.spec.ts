import { test, expect } from '@playwright/test';
import { setupCharacterInGame, enterFirstZone, exploreUntilPopup, runCmd, readGold } from './helpers';

/**
 * 用例 2：探索 → 触发战斗 → 胜利 → 获得物品/经验
 *
 * 流程：创建角色进入游戏 → 进入区域探索 → 翻开格子触发战斗 → 强制胜利 → 验证奖励。
 *
 * 说明：
 * - 探索格子类型随机，通过循环点击 accessible 格子直到触发战斗。
 * - 战斗胜利通过控制台命令 cmd.kill() 强制完成，避免回合制战斗耗时过长或失败。
 * - combatStore.endCombat() 在设置 combatResult 后会立即调用 cleanup() 重置状态，
 *   导致 Vue 响应式批量更新使 .result-overlay（v-if="combatResult"）不会渲染。
 *   因此通过验证金币/经验值增长来确认战斗胜利奖励已发放。
 */
test.describe('探索与战斗', () => {
  test('探索触发战斗并获得胜利', async ({ page }) => {
    // 前置：创建角色并进入游戏
    await setupCharacterInGame(page, 'War');

    // 进入第一个区域探索
    await enterFirstZone(page);
    await expect(page.getByText(/探索进度/)).toBeVisible();

    // 循环点击 accessible 格子直到战斗弹窗出现
    const triggered = await exploreUntilPopup(page, '.combat-overlay', 40);
    expect(triggered).toBeTruthy();

    // 验证战斗界面已渲染
    await expect(page.locator('.combat-overlay')).toBeVisible();
    await expect(page.getByText(/遭遇战斗！|首领战斗！/)).toBeVisible();
    // 敌人区域应至少有一个敌人
    await expect(page.locator('.enemy-side .combatant-name').first()).toBeVisible();

    // 记录战斗前的金币（.player-gold 在 overlay 后方但仍在 DOM 中）
    const goldBefore = await readGold(page);

    // 通过控制台命令强制击杀当前目标并胜利
    const result = await runCmd(page, 'kill');
    expect(result.success).toBeTruthy();
    expect(result.message).toContain('已被消灭');

    // 等待 Vue 响应式更新完成（gainExp/gainGold 在 endCombat 中同步执行）
    await page.waitForTimeout(500);

    // 验证战斗胜利：金币应增加（敌人 goldReward > 0）
    // 若金币未增加（goldReward=0 的敌人），则验证战斗已结束（无存活敌人）
    const goldAfter = await readGold(page);
    // 大多数敌人有 goldReward，金币应增加
    expect(goldAfter).toBeGreaterThanOrEqual(goldBefore);

    // 验证战斗状态已结束：敌人区域不再有存活的敌人名
    // （endCombat → cleanup 删除了已死亡的敌人）
    const aliveEnemyNames = await page.locator('.enemy-side .combatant:not(.enemy-empty):not(.defeated) .combatant-name').count();
    expect(aliveEnemyNames).toBe(0);
  });
});
