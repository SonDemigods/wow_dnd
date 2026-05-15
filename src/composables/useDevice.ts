/**
 * @fileoverview 设备检测与响应式工具
 * @description 提供设备类型检测和响应式布局相关的组合式函数
 * @module composables/useDevice
 */

import { ref, onMounted, onUnmounted } from 'vue';

/** 设备类型 */
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

/** 设备信息 */
export interface DeviceInfo {
  /** 设备类型 */
  type: DeviceType;
  /** 是否为移动设备 */
  isMobile: boolean;
  /** 是否为平板设备 */
  isTablet: boolean;
  /** 是否为桌面设备 */
  isDesktop: boolean;
  /** 视口宽度 */
  viewportWidth: number;
  /** 视口高度 */
  viewportHeight: number;
  /** 是否支持触摸 */
  isTouch: boolean;
  /** 设备像素比 */
  pixelRatio: number;
}

/** 断点配置 */
const breakpoints = {
  mobile: 768,
  tablet: 1024,
};

/**
 * 设备检测组合式函数
 */
export function useDevice() {
  /** 设备信息响应式对象 */
  const deviceInfo = ref<DeviceInfo>({
    type: 'desktop',
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    isTouch: 'ontouchstart' in window,
    pixelRatio: window.devicePixelRatio,
  });

  /**
   * 根据宽度计算设备类型
   * @param width 视口宽度
   */
  const getDeviceType = (width: number): DeviceType => {
    if (width <= breakpoints.mobile) return 'mobile';
    if (width <= breakpoints.tablet) return 'tablet';
    return 'desktop';
  };

  /**
   * 更新设备信息
   */
  const updateDeviceInfo = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const type = getDeviceType(width);

    deviceInfo.value = {
      type,
      isMobile: type === 'mobile',
      isTablet: type === 'tablet',
      isDesktop: type === 'desktop',
      viewportWidth: width,
      viewportHeight: height,
      isTouch: 'ontouchstart' in window,
      pixelRatio: window.devicePixelRatio,
    };
  };

  /** 窗口大小变化处理函数 */
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  const handleResize = () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(updateDeviceInfo, 100);
  };

  onMounted(() => {
    updateDeviceInfo();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('orientationchange', handleResize);
    if (resizeTimer) clearTimeout(resizeTimer);
  });

  return {
    deviceInfo,
    updateDeviceInfo,
  };
}

/**
 * 响应式布局组合式函数
 */
export function useResponsive() {
  const { deviceInfo } = useDevice();

  /**
   * 获取移动端样式前缀类名
   */
  const getDeviceClass = () => {
    return `device-${deviceInfo.value.type}`;
  };

  /**
   * 判断是否小于某个断点
   */
  const isBelow = (breakpoint: number) => deviceInfo.value.viewportWidth < breakpoint;

  /**
   * 判断是否大于某个断点
   */
  const isAbove = (breakpoint: number) => deviceInfo.value.viewportWidth > breakpoint;

  return {
    deviceInfo,
    getDeviceClass,
    isBelow,
    isAbove,
    breakpoints,
  };
}
