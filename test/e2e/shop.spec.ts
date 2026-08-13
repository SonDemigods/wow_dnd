import { test, expect } from '@playwright/test';
import { setupCharacterInGame, enterFirstZone, runCmd, closePopup } from './helpers';

/**
 * 用例 3：商店购买 → 金币扣除 → 物品入背包
 *
 * 流程：创建角色 → 给予金币 → 进入区域 → 点击商店格子 → 购买物品 → 验证金币扣除。
 *
 * 说明：
 * - 商店格子固定放置在探索网格的角落之一，初始即为已探索+可访问状态（class="cell revealed shop"）。
 * - ExplorationView 通过 mousedown/mouseup 事件处理点击（拖拽阈值判定），使用 dispatchEvent 触发。
 * - 购买前通过 cmd.gold 给予足够金币，避免因金币不足无法购买。
 */
test.describe('商店购买', () => {
  test('点击商店格子购买物品并扣除金币', async ({ page }) => {
    // 前置：创建角色并进入游戏
    await setupCharacterInGame(page, 'Shop');

    // 给予足够金币以确保能购买物品
    await runCmd(page, 'gold', 1000);
    await page.waitForTimeout(300);

    // 进入第一个区域探索
    await enterFirstZone(page);
    await expect(page.getByText(/探索进度/)).toBeVisible();

    // 商店格子固定在角落，class 为 cell revealed shop
    const shopCell = page.locator('.cell.shop').first();
    await expect(shopCell).toBeVisible();

    // 通过 dispatchEvent 触发 mousedown + mouseup（ExplorationView 拖拽阈值判定）
    await shopCell.dispatchEvent('mousedown', { button: 0, bubbles: true, clientX: 0, clientY: 0 });
    await shopCell.dispatchEvent('mouseup', { button: 0, bubbles: true, clientX: 0, clientY: 0 });

    // 验证商店界面已渲染
    await expect(page.locator('.shop-content')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.shop-tabs')).toBeVisible();
    // 商店物品列表应至少有一个物品
    await expect(page.locator('.item-card').first()).toBeVisible();

    // 读取购买前的金币（从商店头部的 .gold-display）
    const goldDisplayBefore = await page.locator('.gold-display').first().textContent();
    const goldBefore = parseInt((goldDisplayBefore || '0').replace(/[^\d]/g, ''), 10) || 0;
    expect(goldBefore).toBeGreaterThan(0);

    // 选择第一个可购买的物品
    const firstItem = page.locator('.item-card').first();
    await firstItem.click();
    await page.waitForTimeout(300);

    // 验证物品详情面板已显示，购买按钮可用
    const buyBtn = page.locator('.action-btn.buy');
    await expect(buyBtn).toBeVisible();
    // 确保购买按钮未被禁用（金币足够）
    const isDisabled = await buyBtn.isDisabled();
    expect(isDisabled).toBe(false);

    // 读取物品价格
    const priceText = await page.locator('.detail-info').textContent();
    const priceMatch = priceText?.match(/单价[:\s]*.*?(\d+)/);
    const itemPrice = priceMatch ? parseInt(priceMatch[1], 10) : 0;
    expect(itemPrice).toBeGreaterThan(0);

    // 点击购买
    await buyBtn.click();
    await page.waitForTimeout(500);

    // 验证金币已扣除（从商店头部的 .gold-display 读取）
    const goldDisplayAfter = await page.locator('.gold-display').first().textContent();
    const goldAfter = parseInt((goldDisplayAfter || '0').replace(/[^\d]/g, ''), 10) || 0;
    expect(goldAfter).toBeLessThan(goldBefore);
    expect(goldBefore - goldAfter).toBeGreaterThanOrEqual(itemPrice);

    // 关闭商店弹窗
    await closePopup(page);
    await page.waitForTimeout(300);

    // 验证已回到游戏主界面（底部系统按钮可见）
    await expect(page.getByRole('button', { name: /系统/ })).toBeVisible();
  });
});
