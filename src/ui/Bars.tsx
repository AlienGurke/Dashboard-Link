// A simple bar chart: one bar per entry, a label below every few bars, the value on hover.
// A click on a bar selects it. Plain HTML/CSS, so it scales with the page.

export interface Bar {
  key: string;
  label: string;
  value: number;
  /** shown on hover */
  tip: string;
}

export function Bars({ bars, selected, onSelect, height = 180, unit = "" }: {
  bars: Bar[];
  selected?: string;
  onSelect?: (key: string) => void;
  height?: number;
  unit?: string;
}) {
  if (!bars.length) return <div class="muted chart-empty">–</div>;
  const max = niceMax(Math.max(...bars.map((b) => b.value), 1));
  const labelEvery = Math.max(1, Math.ceil(bars.length / 14));
  return (
    <div class="bars">
      <div class="bars-scale"><span>{fmtNum(max)}{unit}</span><span>{fmtNum(max / 2)}{unit}</span><span>0</span></div>
      <div class="bars-area">
        <div class="bars-plot" style={{ height: `${height}px` }}>
          {bars.map((b) => (
            <div key={b.key} title={b.tip}
              class={"bar" + (b.key === selected ? " sel" : "") + (onSelect ? " click" : "")}
              onClick={() => onSelect?.(b.key)}>
              <div class="bar-fill" style={{ height: `${(100 * b.value) / max}%` }} />
            </div>
          ))}
        </div>
        <div class="bars-labels">
          {bars.map((b, i) => <span key={b.key}>{i % labelEvery === 0 ? b.label : ""}</span>)}
        </div>
      </div>
    </div>
  );
}

function niceMax(v: number): number {
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

const fmtNum = (v: number) => (v >= 10000 ? Math.round(v / 1000).toLocaleString() + "k" : (Math.round(v * 10) / 10).toLocaleString());
