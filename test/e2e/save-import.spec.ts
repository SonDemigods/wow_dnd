import { test, expect } from '@playwright/test';
import path from 'path';
import os from 'os';
import {
  setupCharacterInGame,
  runCmd
} from './helpers';

/**
 * 用例5：存档导出与导入
 *
 * 流程：创建角色 → 导出存档 → 删除角色 → 导入存档 → 验证数据恢复
 *
 * 实现说明：
 * - 导出存档通过 UI 点击"导出存档"按钮，触发浏览器文件下载（downloadBlob）
 * - Playwright 通过 page.waitForEvent('download') 捕获下载并保存到临时路径
 * - 导入存档通过 page.setInputFiles() 设置文件到隐藏的 <input type="file">
 * - 这会触发 handleFileSelected → 验证文件 → 显示导入确认弹窗 → 点击"导入" → importBackup
 * - 删除角色通过 UI 点击 .char-delete → 确认删除弹窗 → confirmDelete
 * - 通过 cmd.game() 返回角色选择界面（切换 gameState，触发 CharacterSelect 重新挂载）
 */
test.describe('存档导出与导入', () => {
  test('导出存档后删除角色再导入恢复数据', async ({ page }) => {
    // 1. 创建角色并进入游戏
    const charName = await setupCharacterInGame(page, 'Save');

    // 给角色一些金币作为标记
    await runCmd(page, 'gold', 500);
    await page.waitForTimeout(300);

    // 2. 返回角色选择界面（通过 cmd.game 切换 gameState）
    await runCmd(page, 'game');
    await page.waitForTimeout(500);

    // 等待角色选择界面渲染
    await page.getByRole('heading', { name: '战争艺术：地下城' }).waitFor({ state: 'visible' });
    await page.waitForTimeout(500); // 等待 loadCharacters 完成

    // 验证角色在列表中
    const charCard = page.locator('.character-card', { hasText: charName });
    await expect(charCard).toBeVisible({ timeout: 5000 });

    // 3. 导出存档：点击"导出存档"按钮，捕获下载文件
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.action-btn.action-btn-export').click();
    const download = await downloadPromise;

    // 保存下载文件到临时路径
    const downloadPath = path.join(os.tmpdir(), `wow_backup_${Date.now()}.json`);
    await download.saveAs(downloadPath);

    // 4. 删除角色：点击角色卡片上的删除按钮
    await charCard.locator('.char-delete').click();

    // 等待删除确认弹窗
    await page.getByRole('heading', { name: '确认删除' }).waitFor({ state: 'visible' });
    await page.locator('.confirm-btn-delete').click();
    await page.waitForTimeout(500);

    // 验证角色已删除（不在列表中）
    await expect(page.locator('.character-card', { hasText: charName })).toHaveCount(0);

    // 5. 导入存档：设置文件到隐藏的 input[type="file"]
    // 这会触发 handleFileSelected → 验证文件 → 显示导入确认弹窗
    await page.setInputFiles('input[type="file"]', downloadPath);

    // 等待导入确认弹窗
    await page.getByRole('heading', { name: '确认导入存档' }).waitFor({ state: 'visible', timeout: 5000 });

    // 点击"导入"按钮确认
    await page.locator('.confirm-modal .confirm-btn-delete').click();

    // 等待导入结果弹窗
    await page.getByRole('heading', { name: '导入成功' }).waitFor({ state: 'visible', timeout: 10000 });

    // 关闭结果弹窗
    await page.locator('.confirm-modal .confirm-btn-cancel').click();
    await page.waitForTimeout(500);

    // 6. 验证角色已恢复（在列表中）
    const restoredCard = page.locator('.character-card', { hasText: charName });
    await expect(restoredCard).toBeVisible({ timeout: 5000 });

    // 验证角色名正确显示
    await expect(restoredCard.locator('.char-name')).toHaveText(charName);
  });
});
