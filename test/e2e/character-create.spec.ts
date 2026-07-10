import { test, expect } from '@playwright/test';
import { waitForAppReady, openCreateModal, makeCharName } from './helpers';

/**
 * 用例 1：创建角色 → 进入游戏 → 首屏渲染
 *
 * 验证完整的角色创建 4 步流程、角色列表刷新、进入游戏后 GameMain 首屏关键元素渲染。
 */
test.describe('角色创建与进入游戏', () => {
  test('完成角色创建流程并进入游戏主界面', async ({ page }) => {
    const charName = makeCharName('Hero');

    // 1. 打开应用，等待角色选择界面
    await waitForAppReady(page);
    await expect(page.getByText('Art of War: Dungeons')).toBeVisible();

    // 2. 打开角色创建弹窗
    await openCreateModal(page);
    await expect(page.getByText(/步骤 1\/4/)).toBeVisible();
    await expect(page.getByText('请选择阵营')).toBeVisible();

    // 3. 步骤 1：选择阵营（点击第一个阵营卡片）
    await page.locator('.faction-card').first().click();
    await expect(page.locator('.faction-card.active')).toBeVisible();
    await page.getByRole('button', { name: '下一步' }).click();

    // 4. 步骤 2：选择种族
    await expect(page.getByText(/步骤 2\/4/)).toBeVisible();
    await page.locator('.race-card').first().click();
    await expect(page.locator('.race-card.active')).toBeVisible();
    await page.getByRole('button', { name: '下一步' }).click();

    // 5. 步骤 3：选择职业
    await expect(page.getByText(/步骤 3\/4/)).toBeVisible();
    await page.locator('.class-card').first().click();
    await expect(page.locator('.class-card.active')).toBeVisible();
    await page.getByRole('button', { name: '下一步' }).click();

    // 6. 步骤 4：输入角色名
    await expect(page.getByText(/步骤 4\/4/)).toBeVisible();
    await page.locator('.name-input').fill(charName);
    await page.getByRole('button', { name: '创建角色', exact: true }).click();

    // 7. 确认弹窗
    await expect(page.getByRole('heading', { name: '确认创建角色' })).toBeVisible();
    await page.getByRole('button', { name: '确认创建' }).click();

    // 8. 验证返回角色选择界面，新角色出现在列表中
    await expect(page.locator('.character-card', { hasText: charName })).toBeVisible();
    await expect(page.locator('.char-level', { hasText: /Lv\.1/ })).toBeVisible();

    // 9. 选中角色并进入游戏
    await page.locator('.character-card', { hasText: charName }).click();
    await page.getByRole('button', { name: '进入游戏' }).click();

    // 10. 验证 GameMain 首屏关键元素渲染
    // 玩家名显示
    await expect(page.locator('.player-name', { hasText: charName })).toBeVisible();
    // 等级
    await expect(page.locator('.player-level')).toContainText(/Lv\./);
    // 金币
    await expect(page.locator('.player-gold')).toBeVisible();
    // 资源条（HP/MP/EXP）
    await expect(page.getByText('HP')).toBeVisible();
    await expect(page.getByText('MP')).toBeVisible();
    await expect(page.getByText('EXP')).toBeVisible();
    // 地图/探索标签
    await expect(page.getByRole('button', { name: /地图/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /探索/ }).first()).toBeVisible();
    // 底部导航按钮
    await expect(page.getByRole('button', { name: /角色/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /背包/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /任务/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /系统/ }).first()).toBeVisible();
  });
});
