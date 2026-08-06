/**
 * @fileoverview 控制台命令汇总注册器
 * @description 统一导入所有命令子模块，触发各模块的 registerCommand() 调用完成注册。
 *
 * 命令子模块在加载时会立即执行 registerCommand()，因此只需 import 即可触发注册。
 * 新增命令类别时，只需在此文件追加 import 行，无需修改 framework.ts。
 *
 * @module console/commands
 */
import './character';
import './inventory';
import './combat';
import './skill';
import './exploration';
import './quest';
import './system';
import './mount';
