/**
 * @fileoverview 文件下载工具函数
 * @description 封装浏览器文件下载逻辑，供 service 层调用，避免 service 直接操作 DOM
 * @module utils/fileDownload
 */

/**
 * 触发浏览器下载 Blob 数据
 *
 * 将 service 层与浏览器 DOM 操作解耦：service 生成 Blob 数据，
 * 下载交互由本工具函数负责，符合分层职责。
 *
 * @param blob - 要下载的 Blob 数据
 * @param filename - 下载文件名（含扩展名）
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  // P4-011 修复：用 try/finally 确保 revokeObjectURL 在异常路径也能执行
  try {
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
}
