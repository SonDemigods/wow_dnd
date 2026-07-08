---
alwaysApply: false
description: 当用户提到“写代码”、“开发功能”、“添加测试”、“跑测试”、“单元测试”、“代码规范”时
---

# wow-dnd-vue 开发与测试强制规范

## 核心原则
1. **测试左移 (TDD)**：测试不是开发完成后的补救，而是开发过程中的导航。复杂逻辑必须先构思测试用例。
2. **隔离与 Mock**：单元测试严禁依赖外部真实环境。Dexie 必须使用 `fake-indexeddb`，Tone.js 必须 Mock，Pinia 必须使用 `@pinia/testing`。
3. **无测试不合并**：开发完成后必须运行全量测试，测试失败或未达标绝对禁止提交。

## 一、 代码编写规范
1. **类型安全**：严格使用 TypeScript，禁止使用 `any`。
2. **命名规范**：
   - 组件文件名使用大驼峰（如 `CharacterSheet.vue`）。
   - 工具函数/组合式函数使用小驼峰（如 `useDice.ts`, `formatDiceRoll.ts`）。
3. **Vue 3 规范**：
   - 必须使用 `<script setup lang="ts">` 语法。
   - 组件逻辑超过 50 行必须抽离为 Composable。
   - Store 的 Action 和 Getter 必须保持纯函数特性，禁止直接操作 DOM。
4. **异常处理**：
   - Dexie 操作必须包含 `try-catch`。
   - Tone.js 初始化需处理浏览器自动播放策略（Autoplay Policy）拒绝异常。

## 二、 全文件类型测试覆盖规范
测试用例必须覆盖 `src` 目录下的所有核心代码，无论后缀是 `.ts` 还是 `.vue`。

### 1. TypeScript 文件 (.ts)
- **纯函数**：验证正常值、空值、边界值入参的返回值。
- **Pinia Store**：验证 State 初始值、Getter 计算结果、Action 对 State 的修改。
- **Dexie 数据库**：使用 `fake-indexeddb` 进行内存级 CRUD 测试。
- **Tone.js 音频**：Mock 浏览器音频接口，仅验证“是否调用了正确的播放方法”及参数正确性。

### 2. Vue 组件文件 (.vue)
- **渲染测试**：使用 `@vue/test-utils` 的 `mount/shallowMount`，验证不同 Props 下的 DOM 渲染。
- **交互测试**：模拟用户操作（`trigger('click')` 等），验证 `emit` 事件触发及内部状态更新。
- **插槽测试**：验证具名插槽、作用域插槽的内容分发。

## 三、 独立 test 目录组织规范
1. **镜像目录**：`test` 文件夹内部结构必须与 `src` 源码目录一一对应。
   - *示例*：`src/composables/useDice.ts` -> `test/composables/useDice.test.ts`
2. **辅助资源隔离**：
   - `test/fixtures/`：存放测试假数据（如 DND 角色 JSON）。
   - `test/mocks/`：存放全局 Mock 对象（Tone.js 模拟、API 拦截）。
   - `test/utils/`：存放自定义测试工具（如 `createTestStore()`）。
3. **路径别名**：测试文件中必须使用 `@/` 别名引入源码，禁止使用冗长的相对路径（如 `../../../src/...`）。
4. **单向依赖**：`src` 目录下的源码绝对禁止导入 `test` 目录下的任何文件。

## 四、 测试编写与运行强制要求
1. **AAA 模式**：严格遵循 `Arrange（准备） - Act（执行） - Assert（断言）` 结构。
2. **断言规范**：每个 `test/it` 块至少包含一个有意义的 `expect`，禁止使用 `console.log` 验证结果。
3. **环境注入**：涉及 Dexie 的测试文件顶部必须引入 `import 'fake-indexeddb/auto'`。
4. **执行流程**：
   - 开发中：保持 `pnpm test:watch` 运行。
   - 提交前：必须执行 `pnpm test`，任何 FAIL/ERROR 禁止推送。
   - 合并前：CI 运行 `pnpm test:coverage`，核心逻辑覆盖率 ≥ 90%，组件/Store 覆盖率 ≥ 80%。

## 五、 常见陷阱与禁忌（红线）
-  严禁在测试中连接真实的 IndexedDB 或发起真实的网络请求。
-  严禁测试用例之间依赖执行顺序或共享可变状态。
-  严禁在 Vue 组件测试中断言具体的 CSS 样式值（样式应通过 E2E 测试）。
-  严禁吞掉异常（空的 `catch` 块），必须抛出预期异常或进行优雅降级。