import type uPlot from "uplot";
import { colour, FAINT, pixelRatio } from "./theme";

interface AxisTicks {
  _splits?: number[] | null;
}

/** A small cross wherever a time tick meets a value tick. */
export function crossesPlugin(): uPlot.Plugin {
  return {
    hooks: {
      drawAxes: (chart) => {
        const ticksOf = (index: number) => (chart.axes[index] as unknown as AxisTicks)._splits ?? [];
        const ratio = pixelRatio();
        const arm = 4 * ratio;
        const { left, top, width, height } = chart.bbox;
        const context = chart.ctx;
        context.save();
        context.strokeStyle = colour(FAINT, 0.8);
        context.lineWidth = ratio;
        context.beginPath();
        for (const time of ticksOf(0)) {
          const x = chart.valToPos(time, "x", true);
          if (x < left || x > left + width) continue;
          for (const value of ticksOf(1)) {
            const y = chart.valToPos(value, "y", true);
            if (y < top || y > top + height) continue;
            context.moveTo(x - arm, y);
            context.lineTo(x + arm, y);
            context.moveTo(x, y - arm);
            context.lineTo(x, y + arm);
          }
        }
        context.stroke();
        context.restore();
      },
    },
  };
}
