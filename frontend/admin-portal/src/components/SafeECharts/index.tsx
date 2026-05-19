import { useEffect, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';

interface SafeEChartsProps {
  option: Record<string, unknown>;
  style?: React.CSSProperties;
  chartKey?: string;
  height?: string | number;
}

/**
 * 安全的 ECharts 包装组件
 * 解决 echarts-for-react 在组件卸载时的 disconnect 错误
 */
const SafeECharts: React.FC<SafeEChartsProps> = ({ option, style, chartKey, height = '400px' }) => {
  const [mounted, setMounted] = useState(false);
  const chartRef = useRef<ReactECharts | null>(null);
  const isUnmountingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 延迟挂载，确保组件完全初始化
    const timer = setTimeout(() => {
      if (!isUnmountingRef.current) {
        setMounted(true);
      }
    }, 10);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    return () => {
      // 在卸载前清理图表实例
      isUnmountingRef.current = true;
      if (chartRef.current) {
        try {
          // 尝试获取 echarts 实例并安全地销毁
          const reactEChartsInstance = chartRef.current as any;
          if (reactEChartsInstance) {
            const echartsInstance = reactEChartsInstance.getEchartsInstance?.();
            if (echartsInstance && typeof echartsInstance.dispose === 'function') {
              echartsInstance.dispose();
            }
          }
        } catch (error) {
          // 忽略清理错误，避免影响其他清理逻辑
        }
        chartRef.current = null;
      }
    };
  }, []);

  // 如果还未挂载，返回占位符
  if (!mounted) {
    return <div ref={containerRef} style={{ ...style, height, width: '100%' }} />;
  }

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <ReactECharts
        ref={chartRef}
        key={chartKey}
        option={option}
        style={{ ...style, height, width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
};

export default SafeECharts;

