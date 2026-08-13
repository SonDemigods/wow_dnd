/**
 * @fileoverview 文件下载工具函数单元测试
 *
 * 覆盖 downloadBlob：
 * 1. URL.createObjectURL 被调用并接收 Blob
 * 2. 创建 <a> 元素并设置 href / download 属性
 * 3. appendChild → click → removeChild 完整流程
 * 4. URL.revokeObjectURL 释放资源
 *
 * Mock 策略：
 * - jsdom 不提供 URL.createObjectURL / revokeObjectURL，需 vi.spyOn mock
 * - document.createElement / appendChild / removeChild 使用真实 jsdom 实现，spy 调用参数
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { downloadBlob } from '@/utils/fileDownload';

describe('downloadBlob 文件下载', () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let appendChildSpy: ReturnType<typeof vi.spyOn>;
  let removeChildSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // jsdom 不提供 URL.createObjectURL / revokeObjectURL，需 mock
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('调用 URL.createObjectURL 创建下载 URL', () => {
    // Arrange
    const blob = new Blob(['test content'], { type: 'text/plain' });

    // Act
    downloadBlob(blob, 'test.txt');

    // Assert
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
  });

  it('创建 <a> 元素并设置 href 和 download 属性', () => {
    // Arrange
    const blob = new Blob(['data'], { type: 'application/json' });

    // Act
    downloadBlob(blob, 'export.json');

    // Assert：通过 appendChild 的参数获取 <a> 元素
    expect(appendChildSpy).toHaveBeenCalledTimes(1);
    const anchor = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor).toBeInstanceOf(HTMLAnchorElement);
    expect(anchor.href).toBe('blob:mock-url');
    expect(anchor.download).toBe('export.json');
  });

  it('将 <a> 元素添加到 body 后触发 click', () => {
    // Arrange
    const blob = new Blob(['data'], { type: 'text/plain' });
    const anchor = document.createElement('a');
    const clickSpy = vi.spyOn(anchor, 'click');
    // 让 createElement 返回我们 spy 的 anchor
    vi.spyOn(document, 'createElement').mockReturnValueOnce(anchor);

    // Act
    downloadBlob(blob, 'file.txt');

    // Assert
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('click 后从 body 移除 <a> 元素', () => {
    // Arrange
    const blob = new Blob(['data'], { type: 'text/plain' });

    // Act
    downloadBlob(blob, 'file.txt');

    // Assert
    expect(removeChildSpy).toHaveBeenCalledTimes(1);
    const removedNode = removeChildSpy.mock.calls[0][0];
    expect(removedNode).toBeInstanceOf(HTMLAnchorElement);
  });

  it('调用 URL.revokeObjectURL 释放资源', () => {
    // Arrange
    const blob = new Blob(['data'], { type: 'text/plain' });

    // Act
    downloadBlob(blob, 'file.txt');

    // Assert
    expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
  });

  it('完整流程顺序：createObjectURL → appendChild → click → removeChild → revokeObjectURL', () => {
    // Arrange
    const blob = new Blob(['data'], { type: 'text/plain' });
    const callOrder: string[] = [];
    createObjectURLSpy.mockImplementation(() => {
      callOrder.push('createObjectURL');
      return 'blob:mock-url';
    });
    appendChildSpy.mockImplementation((node) => {
      callOrder.push('appendChild');
      return node;
    });
    removeChildSpy.mockImplementation((node) => {
      callOrder.push('removeChild');
      return node;
    });
    revokeObjectURLSpy.mockImplementation(() => {
      callOrder.push('revokeObjectURL');
    });

    // Act
    downloadBlob(blob, 'order.txt');

    // Assert
    expect(callOrder).toEqual([
      'createObjectURL',
      'appendChild',
      'removeChild',
      'revokeObjectURL',
    ]);
  });
});
