/**
 * @fileoverview AdminForm 通用表单弹窗组件单元测试
 *
 * 覆盖 AdminForm.vue 的：
 * 1. visible 控制渲染
 * 2. title 渲染在 .form-header h3
 * 3. 字段类型动态渲染：text/number/textarea/select/switch/multiselect/color
 * 4. watch initialData（immediate）初始化表单数据与默认值
 * 5. emit cancel（取消按钮 / 关闭按钮 / overlay click.self）
 * 6. emit submit：点击保存触发，number 字段转数字，json 字段解析
 *
 * 遵循 code_rule：
 *  - 不依赖 Pinia（无 store），使用 mount 真实渲染。
 *  - AAA 模式，每个 it 至少一个有意义的 expect。
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AdminForm from '@/components/admin/AdminForm.vue';
import type { FormField } from '@/components/admin/AdminForm.vue';

const baseFields: FormField[] = [
  { key: 'name', label: '名称', type: 'text', placeholder: '输入名称' },
  { key: 'age', label: '年龄', type: 'number' },
  { key: 'desc', label: '描述', type: 'textarea' },
];

describe('AdminForm 通用表单弹窗组件', () => {
  describe('visible 与标题', () => {
    it('visible=false 时不渲染 .form-overlay', () => {
      const wrapper = mount(AdminForm, {
        props: { visible: false, title: '标题', fields: baseFields },
      });
      expect(wrapper.find('.form-overlay').exists()).toBe(false);
    });

    it('visible=true 时渲染 .form-overlay', () => {
      const wrapper = mount(AdminForm, {
        props: { visible: true, title: '标题', fields: baseFields },
      });
      expect(wrapper.find('.form-overlay').exists()).toBe(true);
    });

    it('title 渲染在 .form-header h3', () => {
      const wrapper = mount(AdminForm, {
        props: { visible: true, title: '编辑阵营', fields: baseFields },
      });
      expect(wrapper.find('.form-header h3').text()).toBe('编辑阵营');
    });
  });

  describe('字段类型动态渲染', () => {
    it('text/number 字段渲染 input（type 对应）', () => {
      const wrapper = mount(AdminForm, {
        props: { visible: true, title: 't', fields: baseFields },
      });
      const nameInput = wrapper.find('#field-name');
      const ageInput = wrapper.find('#field-age');
      expect(nameInput.element.tagName).toBe('INPUT');
      expect((nameInput.element as HTMLInputElement).type).toBe('text');
      expect((ageInput.element as HTMLInputElement).type).toBe('number');
    });

    it('textarea 字段渲染 .form-textarea', () => {
      const wrapper = mount(AdminForm, {
        props: { visible: true, title: 't', fields: baseFields },
      });
      expect(wrapper.find('.form-textarea').exists()).toBe(true);
    });

    it('select 字段渲染 .form-select 与 option 列表', () => {
      const fields: FormField[] = [
        {
          key: 'stat', label: '主属性', type: 'select',
          options: [
            { value: 'str', label: '力量' },
            { value: 'int', label: '智力' },
          ],
        },
      ];
      const wrapper = mount(AdminForm, {
        props: { visible: true, title: 't', fields },
      });
      const select = wrapper.find('.form-select');
      expect(select.exists()).toBe(true);
      // 占位项 + 2 个选项 = 3
      expect(select.findAll('option')).toHaveLength(3);
    });

    it('switch 字段渲染 .switch-container 并展示默认"否"', () => {
      const fields: FormField[] = [{ key: 'stackable', label: '可堆叠', type: 'switch' }];
      const wrapper = mount(AdminForm, {
        props: { visible: true, title: 't', fields },
      });
      expect(wrapper.find('.switch-container').exists()).toBe(true);
      expect(wrapper.find('.switch-label-text').text()).toBe('否');
    });

    it('multiselect 字段渲染各选项 label.multiselect-item', () => {
      const fields: FormField[] = [
        {
          key: 'slots', label: '槽位', type: 'multiselect',
          options: [
            { value: 'weapon1', label: '主手' },
            { value: 'armor1', label: '头部' },
          ],
        },
      ];
      const wrapper = mount(AdminForm, {
        props: { visible: true, title: 't', fields },
      });
      expect(wrapper.findAll('.multiselect-item')).toHaveLength(2);
    });

    it('color 字段渲染 input[type=color].form-color', () => {
      const fields: FormField[] = [{ key: 'color', label: '颜色', type: 'color' }];
      const wrapper = mount(AdminForm, {
        props: { visible: true, title: 't', fields },
      });
      const color = wrapper.find('.form-color');
      expect(color.exists()).toBe(true);
      expect((color.element as HTMLInputElement).type).toBe('color');
    });

    it('disabled 字段渲染禁用 input', () => {
      const fields: FormField[] = [
        { key: 'id', label: 'ID', type: 'text', disabled: true },
      ];
      const wrapper = mount(AdminForm, {
        props: { visible: true, title: 't', fields },
      });
      expect((wrapper.find('#field-id').element as HTMLInputElement).disabled).toBe(true);
    });

    it('custom-fields 插槽渲染在 .form-body 内', () => {
      const wrapper = mount(AdminForm, {
        props: { visible: true, title: 't', fields: baseFields },
        slots: { 'custom-fields': '<div class="custom-slot">自定义</div>' },
      });
      expect(wrapper.find('.form-body .custom-slot').exists()).toBe(true);
    });
  });

  describe('watch initialData 初始化', () => {
    it('传入 initialData 时表单字段被填充', () => {
      const wrapper = mount(AdminForm, {
        props: {
          visible: true, title: 't', fields: baseFields,
          initialData: { name: '人类', age: 30, desc: '描述文本' },
        },
      });
      expect((wrapper.find('#field-name').element as HTMLInputElement).value).toBe('人类');
      expect((wrapper.find('#field-age').element as HTMLInputElement).value).toBe('30');
    });

    it('未传 initialData 时为字段填充默认值（number=0，其余空）', () => {
      const wrapper = mount(AdminForm, {
        props: { visible: true, title: 't', fields: baseFields },
      });
      expect((wrapper.find('#field-age').element as HTMLInputElement).value).toBe('0');
      expect((wrapper.find('#field-name').element as HTMLInputElement).value).toBe('');
    });
  });

  describe('emit cancel', () => {
    it('点击"取消"按钮触发 cancel', async () => {
      const wrapper = mount(AdminForm, {
        props: { visible: true, title: 't', fields: baseFields },
      });
      // .form-footer 中第一个按钮为"取消"
      await wrapper.find('.form-footer .btn-secondary').trigger('click');
      expect(wrapper.emitted('cancel')).toHaveLength(1);
    });

    it('点击右上角关闭按钮触发 cancel', async () => {
      const wrapper = mount(AdminForm, {
        props: { visible: true, title: 't', fields: baseFields },
      });
      await wrapper.find('.close-btn').trigger('click');
      expect(wrapper.emitted('cancel')).toHaveLength(1);
    });

    it('点击 .form-overlay（@click.self）触发 cancel', async () => {
      const wrapper = mount(AdminForm, {
        props: { visible: true, title: 't', fields: baseFields },
      });
      await wrapper.find('.form-overlay').trigger('click');
      expect(wrapper.emitted('cancel')).toHaveLength(1);
    });
  });

  describe('emit submit', () => {
    it('点击"保存"触发 submit 并携带表单数据', async () => {
      const wrapper = mount(AdminForm, {
        props: {
          visible: true, title: 't', fields: baseFields,
          initialData: { name: '战士', age: 20, desc: 'd' },
        },
      });
      await wrapper.find('.form-footer .btn-primary').trigger('click');
      expect(wrapper.emitted('submit')).toHaveLength(1);
      expect(wrapper.emitted('submit')![0][0]).toEqual({ name: '战士', age: 20, desc: 'd' });
    });

    it('number 字段在 submit 时转换为数字类型', async () => {
      const wrapper = mount(AdminForm, {
        props: { visible: true, title: 't', fields: baseFields },
      });
      // 用户在 number 输入框键入字符串值
      await wrapper.find('#field-age').setValue('42');
      await wrapper.find('.form-footer .btn-primary').trigger('click');
      const submitted = wrapper.emitted('submit')![0][0] as Record<string, unknown>;
      expect(submitted.age).toBe(42);
      expect(typeof submitted.age).toBe('number');
    });

    it('json 字段在 submit 时解析为对象', async () => {
      const fields: FormField[] = [
        { key: 'bonus', label: '加成', type: 'json' },
      ];
      const wrapper = mount(AdminForm, {
        props: {
          visible: true, title: 't', fields,
          initialData: { bonus: '{"str": 3, "con": 1}' },
        },
      });
      await wrapper.find('.form-footer .btn-primary').trigger('click');
      const submitted = wrapper.emitted('submit')![0][0] as Record<string, unknown>;
      expect(submitted.bonus).toEqual({ str: 3, con: 1 });
    });
  });
});
