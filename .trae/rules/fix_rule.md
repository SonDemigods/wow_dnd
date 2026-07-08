---
alwaysApply: false
description: 项目检查及bug修复
---

### 1. 缺陷记录
当检测到系统缺陷或异常时，智能体需将问题详情写入 doc/fixed/current.md 文件中进行集中登记。
### 2. 修复与归档
缺陷修复完成后，智能体需执行以下归档操作：
- 将 doc/fixed/current.md 中对应的已修复缺陷记录移出；
- 为移出的记录创建独立归档文件，存放于 doc/fixed/ 目录下；
- 归档文件命名需严格遵循时间戳格式：fixed_yyyyMMddHHmmss.md（例如：fixed_20260708090830.md）。
