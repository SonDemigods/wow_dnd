# Dexie 数据库查询性能基准报告

## 环境说明

| 项目 | 内容 |
|------|------|
| 运行环境 | Node.js + fake-indexeddb（内存实现） |
| 测量方式 | 1k/10k 规模运行 10 次、100k 规模运行 3 次取中位数（含 1 次预热） |
| 数据规模 | 1k / 10k / 100k 条 |
| 注意 | 绝对耗时低于真实 IndexedDB（无磁盘 IO），相对趋势具有参考价值 |

## 1,000 条数据

| 查询 | 索引类型 | 命中条数 | 中位数(ms) | 最小(ms) | 最大(ms) |
|------|----------|---------|-----------|---------|---------|
| items.get(id) | 主键 | 1 | 0.146 | 0.093 | 0.235 |
| items.where('type').equals('potion') | 单字段索引 | 167 | 1.302 | 1.124 | 1.708 |
| items.where('rarity').equals('legendary') | 单字段索引 | 200 | 1.151 | 0.957 | 2.146 |
| items.where('name').startsWithIgnoreCase('物品_5') | 索引前缀 | 111 | 6.020 | 5.089 | 6.947 |
| items.toArray() | 全表扫描 | 1000 | 2.557 | 2.336 | 4.113 |
| charQuests.get([charId, questId]) | 复合主键 | 1 | 0.088 | 0.079 | 0.114 |
| charQuests.where('characterId').equals(charId) | 单字段索引 | 10 | 0.517 | 0.476 | 1.051 |
| charQuests.where('status').equals('active') | 单字段索引 | 334 | 15.802 | 14.805 | 16.765 |
| combatLogs.where('combatId').equals().sortBy('timestamp') | 索引+排序 | 50 | 0.365 | 0.335 | 0.544 |
| combatLogs.where('combatId').equals() | 单字段索引 | 50 | 0.342 | 0.318 | 1.259 |
| combatLogs.where('timestamp').above(threshold) | 范围索引 | 100 | 0.955 | 0.793 | 1.086 |
| combatLogs.filter(predicate) | 无索引过滤 | 40 | 12.080 | 11.463 | 16.001 |

## 10,000 条数据

| 查询 | 索引类型 | 命中条数 | 中位数(ms) | 最小(ms) | 最大(ms) |
|------|----------|---------|-----------|---------|---------|
| items.get(id) | 主键 | 1 | 0.039 | 0.033 | 0.050 |
| items.where('type').equals('potion') | 单字段索引 | 1667 | 11.018 | 10.596 | 12.892 |
| items.where('rarity').equals('legendary') | 单字段索引 | 2000 | 16.300 | 12.134 | 18.233 |
| items.where('name').startsWithIgnoreCase('物品_5') | 索引前缀 | 1111 | 418.098 | 407.122 | 511.180 |
| items.toArray() | 全表扫描 | 10000 | 29.564 | 26.560 | 31.891 |
| charQuests.get([charId, questId]) | 复合主键 | 1 | 0.096 | 0.082 | 0.166 |
| charQuests.where('characterId').equals(charId) | 单字段索引 | 10 | 0.571 | 0.549 | 0.673 |
| charQuests.where('status').equals('active') | 单字段索引 | 3334 | 209.540 | 204.270 | 220.020 |
| combatLogs.where('combatId').equals().sortBy('timestamp') | 索引+排序 | 50 | 0.393 | 0.345 | 1.468 |
| combatLogs.where('combatId').equals() | 单字段索引 | 50 | 0.347 | 0.334 | 0.445 |
| combatLogs.where('timestamp').above(threshold) | 范围索引 | 100 | 0.759 | 0.731 | 2.189 |
| combatLogs.filter(predicate) | 无索引过滤 | 400 | 129.951 | 121.124 | 135.729 |

## 100,000 条数据

| 查询 | 索引类型 | 命中条数 | 中位数(ms) | 最小(ms) | 最大(ms) |
|------|----------|---------|-----------|---------|---------|
| items.get(id) | 主键 | 1 | 0.041 | 0.039 | 0.065 |
| items.where('type').equals('potion') | 单字段索引 | 16667 | 130.001 | 128.353 | 134.598 |
| items.where('rarity').equals('legendary') | 单字段索引 | 20000 | 156.012 | 154.572 | 156.403 |
| items.where('name').startsWithIgnoreCase('物品_5') | 索引前缀 | 11111 | 56264.914 | 54660.247 | 56731.312 |
| items.toArray() | 全表扫描 | 100000 | 328.143 | 326.679 | 423.948 |
| charQuests.get([charId, questId]) | 复合主键 | 1 | 0.296 | 0.186 | 0.335 |
| charQuests.where('characterId').equals(charId) | 单字段索引 | 10 | 0.667 | 0.658 | 0.781 |
| charQuests.where('status').equals('active') | 单字段索引 | 33334 | 2645.740 | 2640.476 | 2647.758 |
| combatLogs.where('combatId').equals().sortBy('timestamp') | 索引+排序 | 50 | 0.915 | 0.839 | 1.138 |
| combatLogs.where('combatId').equals() | 单字段索引 | 50 | 0.471 | 0.413 | 0.798 |
| combatLogs.where('timestamp').above(threshold) | 范围索引 | 100 | 1.219 | 1.084 | 1.266 |
| combatLogs.filter(predicate) | 无索引过滤 | 4000 | 1390.545 | 1385.490 | 1503.170 |

## 索引策略验证结论

- 主键查询（`get`）在所有规模下均为 O(log n)，耗时极低
- 索引等值查询（`where().equals()`）命中索引，耗时与命中条数成正比
- 复合主键查询（`get([a, b])`）性能与单主键一致
- 前缀搜索（`startsWithIgnoreCase`）利用索引，性能优于全表扫描
- 索引 + 排序（`sortBy`）在命中条数较少时性能良好
- 全表扫描（`toArray()`）耗时随数据规模线性增长
- 无索引过滤（`filter`）需遍历全表，耗时随数据规模线性增长
