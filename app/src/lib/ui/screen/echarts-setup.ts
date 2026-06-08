// echarts 按需注册:只引核心 + 大屏实际用到的图表/组件/渲染器,控打包体积。
// 配合 echarts-for-react/lib/core 把此实例传入(见 charts/EChart.tsx)。
import * as echarts from "echarts/core";
import {
  LineChart,
  BarChart,
  PieChart,
  RadarChart,
  FunnelChart,
  ScatterChart,
  HeatmapChart,
  GaugeChart,
} from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  MarkLineComponent,
  GraphicComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  RadarChart,
  FunnelChart,
  ScatterChart,
  HeatmapChart,
  GaugeChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  MarkLineComponent,
  GraphicComponent,
  CanvasRenderer,
]);

export { echarts };
