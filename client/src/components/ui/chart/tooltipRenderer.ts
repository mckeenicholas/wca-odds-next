import escapeHtml from "escape-html";
import { type Component, createApp } from "vue";
import HistogramCustomTooltip from "@/components/charts/HistogramCustomTooltip.vue";
import PercentageTooltip from "@/components/charts/PercentageTooltip.vue";
import { formatPercentage, renderTime } from "@/lib/utils";
import ChartTooltip from "./ChartTooltip.vue";

export function renderTooltipHtml(
  TooltipComponent: Component,
  props: {
    title?: string;
    data: any[];
    isFmc?: boolean;
    [key: string]: any;
  },
): string {
  // 1. Direct reference checks for pre-compiled performance optimizations
  if (TooltipComponent === ChartTooltip) {
    const titleHtml = props.title
      ? `<div class="flex flex-col space-y-1.5 border-b p-3">
           <h3 class="text-2xl leading-none font-semibold tracking-tight">${escapeHtml(String(props.title))}</h3>
         </div>`
      : "";

    const contentRows = props.data
      .map(
        (item) => `
      <div class="flex justify-between">
        <div class="flex items-center">
          <span class="mr-2 h-2.5 w-2.5">
            <svg width="100%" height="100%" viewBox="0 0 30 30">
              <path
                d=" M 15 15 m -14, 0 a 14,14 0 1,1 28,0 a 14,14 0 1,1 -28,0"
                stroke="${escapeHtml(String(item.color))}"
                fill="${escapeHtml(String(item.color))}"
                stroke-width="1"
              />
            </svg>
          </span>
          <span>${escapeHtml(String(item.name))}</span>
        </div>
        <span class="ml-4 font-semibold">${escapeHtml(String(item.value))}</span>
      </div>
    `,
      )
      .join("");

    return `
      <div class="rounded-lg border bg-card text-card-foreground shadow-sm overflow-auto text-sm">
        ${titleHtml}
        <div class="p-3 flex min-w-45 flex-col gap-1">
          ${contentRows}
        </div>
      </div>
    `;
  }

  if (TooltipComponent === PercentageTooltip) {
    const toPlaceString = (place: number): string => {
      const suffixes = ["th", "st", "nd", "rd"];
      const mod100 = place % 100;
      if (mod100 >= 11 && mod100 <= 13) return `${place}th`;
      const suffix = suffixes[place % 10] || suffixes[0];
      return `${place}${suffix}`;
    };

    const titleHtml = props.title
      ? `<p class="font-bold">${escapeHtml(toPlaceString(parseInt(props.title)))}</p>`
      : "";

    const contentRows = props.data
      .map(
        (item) => `
      <div class="flex justify-between text-sm">
        <div class="flex items-center">
          <span class="mr-2 h-2.5 w-2.5">
            <svg width="10" height="10" viewBox="0 0 30 30">
              <path
                d="M 15 15 m -14, 0 a 14,14 0 1,1 28,0 a 14,14 0 1,1 -28,0"
                stroke="${escapeHtml(String(item.color))}"
                fill="${escapeHtml(String(item.color))}"
                stroke-width="1"
              />
            </svg>
          </span>
          <span>${escapeHtml(String(item.name))}</span>
        </div>
        <span class="ml-4 font-semibold">${escapeHtml(formatPercentage(item.value))}</span>
      </div>
    `,
      )
      .join("");

    return `
      <div class="rounded-md p-2">
        ${titleHtml}
        ${contentRows}
      </div>
    `;
  }

  if (TooltipComponent === HistogramCustomTooltip) {
    const isFmc = !!props.isFmc;
    const timeRawValue = parseInt(props.title ?? "0");
    const timeDisplayValue = renderTime(timeRawValue, isFmc);

    const contentRows = props.data
      .map((item) => {
        if (isFmc && item.name === "single" && timeRawValue % 100 !== 0) {
          return "";
        }
        const valDisplay =
          item.value >= 0.01 ? `${item.value.toFixed(2)}%` : "<0.01%";
        return `
        <div class="flex justify-between text-sm">
          <div class="flex items-center">
            <span class="mr-2 h-2.5 w-2.5">
              <svg width="10" height="10" viewBox="0 0 30 30">
                <path
                  d="M 15 15 m -14, 0 a 14,14 0 1,1 28,0 a 14,14 0 1,1 -28,0"
                  stroke="${escapeHtml(String(item.color))}"
                  fill="${escapeHtml(String(item.color))}"
                  stroke-width="1"
                />
              </svg>
            </span>
            <span>${escapeHtml(String(item.name))}</span>
          </div>
          <span class="ml-4 font-semibold">${escapeHtml(valDisplay)}</span>
        </div>
      `;
      })
      .join("");

    return `
      <div class="rounded-md p-2">
        <p class="font-bold">${escapeHtml(timeDisplayValue)}</p>
        ${contentRows}
      </div>
    `;
  }

  // 2. Fallback to mounting Vue app for unknown custom tooltips to ensure backward compatibility
  const componentDiv = document.createElement("div");
  const app = createApp(TooltipComponent, props);
  app.mount(componentDiv);
  const html = componentDiv.innerHTML;
  app.unmount();
  return html;
}
