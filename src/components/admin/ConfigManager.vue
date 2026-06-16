<template>
  <div class="config-manager">
    <h2 class="page-title">
      {{ store.currentTableMeta?.label || '配置管理' }}
    </h2>

    <AdminTable
      :columns="currentColumns"
      :data="store.tableData"
      :total-count="store.tableData.length"
      @create="handleCreate"
      @edit="handleEdit"
      @delete="handleDelete"
      @refresh="store.loadTableData"
      @search="store.doSearch($event)"
    />

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteConfirm" class="confirm-overlay" @click.self="showDeleteConfirm = false">
      <div class="confirm-dialog">
        <div class="confirm-header">
          <h3>确认删除</h3>
        </div>
        <div class="confirm-body">
          <p>确定要删除此记录吗？此操作不可撤销。</p>
        </div>
        <div class="confirm-footer">
          <button class="btn btn-secondary" @click="showDeleteConfirm = false">取消</button>
          <button class="btn btn-danger" @click="confirmDelete">确认删除</button>
        </div>
      </div>
    </div>

    <!-- 编辑/创建表单弹窗 -->
    <AdminForm
      :visible="store.formConfig.visible"
      :title="store.formConfig.title"
      :fields="currentFormFields"
      :initial-data="store.editingRecord"
      @submit="handleFormSubmit"
      @cancel="store.closeForm"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 配置表管理组件
 *
 * 根据当前选中的配置表动态切换表格列定义和表单字段，
 * 实现所有10个配置表（阵营/种族/职业/物品/装备/敌人/任务/技能/地点/商店）的统一管理
 */
import { ref, computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useAdminStore } from '@/modules/admin';
import { CONFIG_TABLES, type ConfigTableName } from '@/modules/admin/types';
import type { TableColumn } from './AdminTable.vue';
import type { FormField } from './AdminForm.vue';
import AdminTable from './AdminTable.vue';
import AdminForm from './AdminForm.vue';

const store = useAdminStore();

// ========== 字典值 → 中文翻译映射表 ==========

const FACTION_NAMES: Record<string, string> = {
  alliance: '光辉盟约', horde: '铁血盟约', neutral: '中立',
};

const STAT_NAMES: Record<string, string> = {
  str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力',
};

const RARITY_NAMES: Record<string, string> = {
  common: '普通', uncommon: '优秀', rare: '精良', epic: '史诗', legendary: '传说',
};

const ITEM_TYPE_NAMES: Record<string, string> = {
  potion: '药水', scroll: '卷轴', food: '食物', material: '材料', quest: '任务物品', misc: '杂项',
};

const EQUIP_TYPE_NAMES: Record<string, string> = {
  weapon: '武器', armor: '护甲',
};

const LOCATION_TYPE_NAMES: Record<string, string> = {
  location: '地点', continent: '大陆',
};

const QUEST_TYPE_NAMES: Record<string, string> = {
  kill: '击杀', collect: '收集',
};

const SKILL_TYPE_NAMES: Record<string, string> = {
  physical_damage: '物理伤害', magic_damage: '魔法伤害', health_restore: '生命恢复', mana_restore: '法力恢复',
};

const SHOP_TYPE_NAMES: Record<string, string> = {
  general: '杂货', potion: '药水', scroll: '卷轴', food: '食品', material: '材料',
};

/** 获取字典翻译，若未匹配则原样返回 */
function t(map: Record<string, string>, val: any): string {
  if (val === null || val === undefined) return '-';
  return map[String(val)] ?? String(val);
}

/** 参考数据缓存 —— 供下拉选择使用 */
const {
  referenceFactions: factionOptions,
  referenceRaces: raceOptions,
  referenceClasses: classOptions,
  referenceLocations: locationOptions,
  referenceContinents: continentOptions,
} = storeToRefs(store);

onMounted(() => {
  store.loadReferenceData();
});

/** 是否显示删除确认 */
const showDeleteConfirm = ref(false);
/** 待删除的记录 */
const pendingDeleteRecord = ref<any>(null);

/** 各配置表的列定义 */
const tableColumns: Record<ConfigTableName, TableColumn[]> = {
  factions: [
    { key: 'id', label: 'ID', width: '180px' },
    { key: 'name', label: '名称' },
    { key: 'icon', label: '图标' },
    { key: 'color', label: '颜色', format: (v) => v },
  ],
  races: [
    { key: 'id', label: 'ID', width: '180px' },
    { key: 'name', label: '名称' },
    { key: 'icon', label: '图标' },
    { key: 'factionId', label: '阵营' },
  ],
  classes: [
    { key: 'id', label: 'ID', width: '180px' },
    { key: 'name', label: '名称' },
    { key: 'icon', label: '图标' },
    { key: 'primaryStat', label: '主属性' },
    { key: 'color', label: '颜色' },
  ],
  items: [
    { key: 'id', label: 'ID', width: '180px' },
    { key: 'name', label: '名称' },
    { key: 'type', label: '类型' },
    { key: 'rarity', label: '稀有度' },
    { key: 'value', label: '价值' },
  ],
  equipmentItems: [
    { key: 'id', label: 'ID', width: '180px' },
    { key: 'name', label: '名称' },
    { key: 'type', label: '类型' },
    { key: 'rarity', label: '稀有度' },
    { key: 'value', label: '价值' },
  ],
  mobs: [
    { key: 'id', label: 'ID', width: '180px' },
    { key: 'name', label: '名称' },
    { key: 'dangerLevel', label: '危险等级' },
    { key: 'maxHp', label: '生命值' },
    { key: 'xp', label: '经验值' },
  ],
  bosses: [
    { key: 'id', label: 'ID', width: '180px' },
    { key: 'name', label: '名称' },
    { key: 'dangerLevel', label: '危险等级' },
    { key: 'maxHp', label: '生命值' },
    { key: 'xp', label: '经验值' },
  ],
  quests: [
    { key: 'id', label: 'ID', width: '180px' },
    { key: 'title', label: '标题' },
    { key: 'type', label: '类型' },
    { key: 'levelRequirement', label: '等级需求' },
    { key: 'xpReward', label: '经验奖励' },
  ],
  skills: [
    { key: 'id', label: 'ID', width: '180px' },
    { key: 'name', label: '名称' },
    { key: 'type', label: '类型' },
    { key: 'mpCost', label: '法力消耗' },
    { key: 'unlockLevel', label: '解锁等级' },
  ],
  locations: [
    { key: 'id', label: 'ID', width: '180px' },
    { key: 'name', label: '名称' },
    { key: 'type', label: '类型' },
    { key: 'continent', label: '大陆' },
  ],
  shops: [
    { key: 'id', label: 'ID', width: '180px' },
    { key: 'name', label: '名称' },
    { key: 'type', label: '类型' },
    { key: 'refreshInterval', label: '刷新间隔' },
  ],
};

/** 各配置表的表单字段定义 */
const formFieldsMap: Record<ConfigTableName, FormField[]> = {
  factions: [
    { key: 'id', label: 'ID', type: 'text', placeholder: '唯一标识，如 alliance' },
    { key: 'name', label: '名称', type: 'text', placeholder: '阵营名称' },
    { key: 'icon', label: '图标', type: 'text', placeholder: 'emoji 图标，如 🦁' },
    { key: 'color', label: '颜色', type: 'color' },
    { key: 'description', label: '描述', type: 'textarea', placeholder: '阵营描述' },
  ],
  races: [
    { key: 'id', label: 'ID', type: 'text', placeholder: '唯一标识' },
    { key: 'name', label: '名称', type: 'text', placeholder: '种族名称' },
    { key: 'icon', label: '图标', type: 'text', placeholder: 'emoji 图标' },
    { key: 'factionId', label: '阵营ID', type: 'text', placeholder: 'alliance / horde / neutral' },
    { key: 'bonus', label: '属性加成', type: 'json', placeholder: '{"str": 2, "con": 1}' },
    { key: 'description', label: '描述', type: 'textarea', placeholder: '种族描述' },
  ],
  classes: [
    { key: 'id', label: 'ID', type: 'text', placeholder: '唯一标识' },
    { key: 'name', label: '名称', type: 'text', placeholder: '职业名称' },
    { key: 'icon', label: '图标', type: 'text', placeholder: 'emoji 图标' },
    { key: 'primaryStat', label: '主属性', type: 'select', options: [
      { value: 'str', label: '力量 (str)' },
      { value: 'dex', label: '敏捷 (dex)' },
      { value: 'con', label: '体质 (con)' },
      { value: 'int', label: '智力 (int)' },
      { value: 'wis', label: '感知 (wis)' },
      { value: 'cha', label: '魅力 (cha)' },
    ] },
    { key: 'factionsIds', label: '可选阵营', type: 'multiselect' },
    { key: 'raceIds', label: '可选种族', type: 'multiselect' },
    { key: 'description', label: '描述', type: 'textarea', placeholder: '职业描述' },
    { key: 'color', label: '颜色', type: 'color' },
    { key: 'bonus', label: '属性加成', type: 'json', placeholder: '{"str": 1, "int": 2}' },
  ],
  items: [
    { key: 'id', label: 'ID', type: 'text', placeholder: '唯一标识' },
    { key: 'name', label: '名称', type: 'text', placeholder: '物品名称' },
    { key: 'type', label: '类型', type: 'select', options: [
      { value: 'potion', label: '药水 (potion)' },
      { value: 'scroll', label: '卷轴 (scroll)' },
      { value: 'food', label: '食物 (food)' },
      { value: 'material', label: '材料 (material)' },
      { value: 'quest', label: '任务物品 (quest)' },
      { value: 'misc', label: '杂项 (misc)' },
    ] },
    { key: 'rarity', label: '稀有度', type: 'text', placeholder: 'common/uncommon/rare/epic/legendary' },
    { key: 'icon', label: '图标', type: 'text', placeholder: 'emoji 图标' },
    { key: 'description', label: '描述', type: 'textarea', placeholder: '物品描述' },
    { key: 'bonus', label: '属性加成', type: 'json', placeholder: '{"hp": 50}' },
    { key: 'effect', label: '效果', type: 'json', placeholder: '{"type": "heal", "value": 50}' },
    { key: 'value', label: '价值', type: 'number' },
    { key: 'stackable', label: '可堆叠', type: 'switch' },
    { key: 'consumable', label: '消耗品', type: 'switch' },
  ],
  equipmentItems: [
    { key: 'id', label: 'ID', type: 'text', placeholder: '唯一标识' },
    { key: 'name', label: '名称', type: 'text', placeholder: '装备名称' },
    { key: 'type', label: '类型', type: 'select', options: [
      { value: 'weapon', label: '武器 (weapon)' },
      { value: 'armor', label: '护甲 (armor)' },
    ] },
    { key: 'rarity', label: '稀有度', type: 'text', placeholder: 'common/uncommon/rare/epic/legendary' },
    { key: 'icon', label: '图标', type: 'text', placeholder: 'emoji 图标' },
    { key: 'description', label: '描述', type: 'textarea', placeholder: '装备描述' },
    { key: 'bonus', label: '属性加成', type: 'json', placeholder: '{"str": 3}' },
    { key: 'effect', label: '效果', type: 'json', placeholder: '{"type": "damage", "value": 5}' },
    { key: 'value', label: '价值', type: 'number' },
    { key: 'slots', label: '适用槽位', type: 'multiselect' },
    { key: 'levelRequirement', label: '等级需求', type: 'number' },
  ],
  mobs: [
    { key: 'id', label: 'ID', type: 'text', placeholder: '唯一标识' },
    { key: 'name', label: '名称', type: 'text', placeholder: '怪物名称' },
    { key: 'icon', label: '图标', type: 'text', placeholder: 'emoji 图标' },
    { key: 'maxHp', label: '最大生命值', type: 'number' },
    { key: 'damage', label: '伤害范围', type: 'json', placeholder: '[5, 15]' },
    { key: 'xp', label: '经验值', type: 'number' },
    { key: 'gold', label: '金币', type: 'number' },
    { key: 'dangerLevel', label: '危险等级', type: 'text', placeholder: '危险等级' },
  ],
  bosses: [
    { key: 'id', label: 'ID', type: 'text', placeholder: '唯一标识' },
    { key: 'name', label: '名称', type: 'text', placeholder: 'Boss名称' },
    { key: 'icon', label: '图标', type: 'text', placeholder: 'emoji 图标' },
    { key: 'maxHp', label: '最大生命值', type: 'number' },
    { key: 'damage', label: '伤害范围', type: 'json', placeholder: '[5, 15]' },
    { key: 'xp', label: '经验值', type: 'number' },
    { key: 'gold', label: '金币', type: 'number' },
    { key: 'dangerLevel', label: '危险等级', type: 'text', placeholder: '危险等级' },
  ],
  quests: [
    { key: 'id', label: 'ID', type: 'text', placeholder: '唯一标识' },
    { key: 'title', label: '标题', type: 'text', placeholder: '任务标题' },
    { key: 'description', label: '描述', type: 'textarea', placeholder: '任务描述' },
    { key: 'type', label: '类型', type: 'text', placeholder: 'kill/collect/explore' },
    { key: 'objectives', label: '目标', type: 'json', placeholder: '[{"key":"enemy","type":"kill","description":"击杀","target":5}]' },
    { key: 'levelRequirement', label: '等级需求', type: 'number' },
    { key: 'xpReward', label: '经验奖励', type: 'number' },
    { key: 'goldReward', label: '金币奖励', type: 'number' },
    { key: 'boardId', label: '区域ID', type: 'select' },
  ],
  skills: [
    { key: 'id', label: 'ID', type: 'text', placeholder: '唯一标识' },
    { key: 'name', label: '名称', type: 'text', placeholder: '技能名称' },
    { key: 'icon', label: '图标', type: 'text', placeholder: 'emoji 图标' },
    { key: 'description', label: '描述', type: 'textarea', placeholder: '技能描述' },
    { key: 'mpCost', label: '法力消耗', type: 'number' },
    { key: 'type', label: '类型', type: 'select', options: [
      { value: 'physical_damage', label: '物理伤害 (physical_damage)' },
      { value: 'magic_damage', label: '魔法伤害 (magic_damage)' },
      { value: 'health_restore', label: '生命恢复 (health_restore)' },
      { value: 'mana_restore', label: '法力恢复 (mana_restore)' },
    ] },
    { key: 'effect', label: '效果', type: 'json', placeholder: '{"type":"damage","value":20}' },
    { key: 'unlockLevel', label: '解锁等级', type: 'number' },
    { key: 'classRestriction', label: '职业限制', type: 'text', placeholder: 'warrior/mage 等，空为无限制' },
  ],
  locations: [
    { key: 'id', label: 'ID', type: 'text', placeholder: '唯一标识' },
    { key: 'name', label: '名称', type: 'text', placeholder: '地点/大陆名称' },
    { key: 'type', label: '类型', type: 'select', options: [
      { value: 'location', label: '地点 (location)' },
      { value: 'continent', label: '大陆 (continent)' },
    ] },
    { key: 'icon', label: '图标', type: 'text', placeholder: 'emoji 图标' },
    { key: 'description', label: '描述', type: 'textarea', placeholder: '地点描述' },
    { key: 'continent', label: '所属大陆', type: 'select' },
    { key: 'levelRange', label: '等级范围', type: 'json', placeholder: '[1, 10]' },
    { key: 'color', label: '颜色', type: 'color' },
    { key: 'mapX', label: '地图坐标X', type: 'number' },
    { key: 'mapY', label: '地图坐标Y', type: 'number' },
    { key: 'position', label: '大陆方位', type: 'text', placeholder: 'north/south/east/west' },
  ],
  shops: [
    { key: 'id', label: 'ID', type: 'text', placeholder: '唯一标识' },
    { key: 'name', label: '名称', type: 'text', placeholder: '商店名称' },
    { key: 'type', label: '类型', type: 'text', placeholder: 'general/potion/equipment 等' },
    { key: 'icon', label: '图标', type: 'text', placeholder: 'emoji 图标' },
    { key: 'refreshInterval', label: '刷新间隔', type: 'number', placeholder: '刷新间隔（秒）' },
    { key: 'priceVariation', label: '价格浮动', type: 'json', placeholder: '{"min": 0.8, "max": 1.2}' },
  ],
};

/** 当前表名 */
const currentTable = computed<ConfigTableName>(() => store.selectedConfigTable);

/** 当前表对应的 Dexie 表名 */
const currentDbTable = computed(() => {
  const meta = CONFIG_TABLES.find(t => t.key === currentTable.value);
  return meta?.dbTable || '';
});

/** 当前列定义（注入字典翻译） */
const currentColumns = computed<TableColumn[]>(() => {
  return tableColumns[currentTable.value].map(col => {
    // factionId → 中文阵营名
    if (col.key === 'factionId' && factionOptions.value.length > 0) {
      return { ...col, format: (v: any) => t(FACTION_NAMES, v) };
    }
    // 种族/职业 ID → 中文名（从数据库加载的映射）
    if (col.key === 'raceId' && raceOptions.value.length > 0) {
      const map = Object.fromEntries(raceOptions.value.map(o => [o.value, o.label]));
      return { ...col, format: (v: any) => map[String(v)] ?? String(v ?? '-') };
    }
    if (col.key === 'classId' && classOptions.value.length > 0) {
      const map = Object.fromEntries(classOptions.value.map(o => [o.value, o.label]));
      return { ...col, format: (v: any) => map[String(v)] ?? String(v ?? '-') };
    }
    // 字典字段翻译
    if (col.key === 'primaryStat') return { ...col, format: (v: any) => t(STAT_NAMES, v) };
    if (col.key === 'rarity') return { ...col, format: (v: any) => t(RARITY_NAMES, v) };
    if (col.key === 'dangerLevel') return { ...col, format: (v: any) => String(v ?? '-') };
    if (col.key === 'continent') {
      if (continentOptions.value.length > 0) {
        const map = Object.fromEntries(continentOptions.value.map(o => [o.value, o.label]));
        return { ...col, format: (v: any) => map[String(v)] ?? String(v ?? '-') };
      }
      return { ...col, format: (v: any) => String(v ?? '-') };
    }
    // type 字段按表名区分翻译
    if (col.key === 'type') {
      const tn = currentTable.value;
      if (tn === 'items') return { ...col, format: (v: any) => t(ITEM_TYPE_NAMES, v) };
      if (tn === 'equipmentItems') return { ...col, format: (v: any) => t(EQUIP_TYPE_NAMES, v) };
      if (tn === 'locations') return { ...col, format: (v: any) => t(LOCATION_TYPE_NAMES, v) };
      if (tn === 'quests') return { ...col, format: (v: any) => t(QUEST_TYPE_NAMES, v) };
      if (tn === 'skills') return { ...col, format: (v: any) => t(SKILL_TYPE_NAMES, v) };
      if (tn === 'shops') return { ...col, format: (v: any) => t(SHOP_TYPE_NAMES, v) };
    }
    return col;
  });
});

/** 当前表单字段（注入下拉选项的最终版本） */
const currentFormFields = computed<FormField[]>(() => {
  const baseFields = formFieldsMap[currentTable.value] || [];
  return baseFields.map(field => {
    // 为阵营、种族、职业等关联字段注入下拉选项
    if (field.key === 'factionId' && factionOptions.value.length > 0) {
      return { ...field, type: 'select' as const, options: factionOptions.value };
    }
    if (field.key === 'factionsIds' && factionOptions.value.length > 0) {
      return { ...field, type: 'multiselect' as const, options: factionOptions.value };
    }
    if (field.key === 'raceId' && raceOptions.value.length > 0) {
      return { ...field, type: 'select' as const, options: raceOptions.value };
    }
    if (field.key === 'raceIds' && raceOptions.value.length > 0) {
      return { ...field, type: 'multiselect' as const, options: raceOptions.value };
    }
    if (field.key === 'classId' && classOptions.value.length > 0) {
      return { ...field, type: 'select' as const, options: classOptions.value };
    }
    if (field.key === 'slots') {
      return {
        ...field,
        type: 'multiselect' as const,
        options: [
          { value: 'weapon1', label: '主手 (weapon1)' },
          { value: 'weapon2', label: '副手 (weapon2)' },
          { value: 'armor1', label: '头部 (armor1)' },
          { value: 'armor2', label: '胸部 (armor2)' },
          { value: 'armor3', label: '腿部 (armor3)' },
          { value: 'armor4', label: '鞋子 (armor4)' },
        ],
      };
    }
    if (field.key === 'classRestriction' && classOptions.value.length > 0) {
      return {
        ...field,
        type: 'select' as const,
        options: [{ value: '', label: '无限制' }, ...classOptions.value],
      };
    }
    if (field.key === 'boardId' && locationOptions.value.length > 0) {
      return {
        ...field,
        type: 'select' as const,
        options: locationOptions.value,
      };
    }
    if (field.key === 'continent' && continentOptions.value.length > 0) {
      return {
        ...field,
        type: 'select' as const,
        options: continentOptions.value,
      };
    }
    // 稀有度下拉
    if (field.key === 'rarity') {
      return {
        ...field,
        type: 'select' as const,
        options: [
          { value: 'common', label: '普通 (common)' },
          { value: 'uncommon', label: '优秀 (uncommon)' },
          { value: 'rare', label: '稀有 (rare)' },
          { value: 'epic', label: '史诗 (epic)' },
          { value: 'legendary', label: '传说 (legendary)' },
        ],
      };
    }
    // 敌人危险等级下拉（对齐 DB 实际值）
    if (field.key === 'dangerLevel') {
      return {
        ...field,
        type: 'select' as const,
        options: [
          { value: '普通', label: '普通' },
          { value: '困难', label: '困难' },
          { value: '危险', label: '危险' },
          { value: '极危险', label: '极危险' },
          { value: '致命', label: '致命' },
        ],
      };
    }
    return field;
  });
});

/** 打开创建表单 */
function handleCreate() {
  store.openCreateForm(`新增${store.currentTableMeta?.label || '记录'}`);
}

/** 打开编辑表单 */
function handleEdit(row: any) {
  store.openEditForm(row, `编辑${store.currentTableMeta?.label || '记录'}`);
}

/** 打开删除确认 */
function handleDelete(row: any) {
  pendingDeleteRecord.value = row;
  showDeleteConfirm.value = true;
}

/** 确认删除 */
async function confirmDelete() {
  if (!pendingDeleteRecord.value) return;
  const id = pendingDeleteRecord.value.id ?? pendingDeleteRecord.value.characterId;
  await store.deleteRecord(currentDbTable.value, id);
  showDeleteConfirm.value = false;
  pendingDeleteRecord.value = null;
}

/** 提交表单 */
async function handleFormSubmit(data: Record<string, any>) {
  await store.saveRecord(currentDbTable.value, data);
}
</script>

<style lang="less" scoped>
@import '@/styles/variables.less';

.config-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.page-title {
  color: @accent-color;
  font-size: 22px;
  margin: 0 0 20px;
}

.btn {
  padding: 8px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  border: 1px solid @border-color;

  &-secondary {
    background: transparent;
    color: @text-primary;
  }

  &-danger {
    background: @danger-color;
    color: #fff;
    border-color: @danger-color;
  }

  &:hover {
    opacity: 0.85;
  }
}

.confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.confirm-dialog {
  background: @secondary-bg;
  border: 2px solid @border-color;
  border-radius: 12px;
  width: 400px;
}

.confirm-header {
  padding: 16px 20px;
  border-bottom: 1px solid @border-color;

  h3 {
    color: @danger-color;
    margin: 0;
  }
}

.confirm-body {
  padding: 20px;
  color: @text-primary;
}

.confirm-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid @border-color;
}
</style>
