import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  type ChartOptions
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { useTheme } from '../../context/ThemeContext';
import type { OrderItem, ProductItem } from '../../mockData';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

interface CategorySegment {
  id: number;
  name: string;
  count: number;
  stockUnits: number;
  share: number;
  color: string;
}

export function CategoryDoughnutChart({
  segments,
  totalProducts,
  centerLabel = 'Active Batches'
}: {
  segments: CategorySegment[];
  totalProducts: number;
  centerLabel?: string;
}) {
  const { isDark } = useTheme();

  const data = useMemo(
    () => ({
      labels: segments.map((s) => s.name),
      datasets: [
        {
          label: 'Harvest Batches',
          data: segments.map((s) => s.count),
          backgroundColor: segments.map((s) => s.color),
          borderColor: isDark ? '#101c16' : '#ffffff',
          borderWidth: 2,
          hoverOffset: 6
        }
      ]
    }),
    [segments, isDark]
  );

  const options = useMemo<ChartOptions<'doughnut'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: isDark ? '#0e1b14' : '#0f172a',
          titleColor: '#f8fafc',
          bodyColor: '#e2e8f0',
          borderColor: isDark ? '#1c3629' : '#334155',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) => {
              const idx = ctx.dataIndex;
              const seg = segments[idx];
              if (!seg) return `${ctx.label}: ${ctx.parsed}`;
              return ` ${seg.count} batches (${seg.share}%) · ${seg.stockUnits.toLocaleString()} units`;
            }
          }
        }
      }
    }),
    [segments, isDark]
  );

  return (
    <div className="relative w-44 h-44 mx-auto my-4">
      <Doughnut data={data} options={options} />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
          {totalProducts}
        </span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
          {centerLabel}
        </span>
      </div>
    </div>
  );
}

export function ReportsTradeBarChart({ orders }: { orders: OrderItem[] }) {
  const { isDark } = useTheme();

  const statuses: OrderItem['orderStatus'][] = [
    'placed',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled'
  ];

  const { counts, revenues } = useMemo(() => {
    const c = statuses.map((st) => orders.filter((o) => o.orderStatus === st).length);
    const r = statuses.map((st) =>
      Math.round(
        orders
          .filter((o) => o.orderStatus === st)
          .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0) / 1000
      )
    );
    return { counts: c, revenues: r };
  }, [orders]);

  const data = useMemo(
    () => ({
      labels: ['Placed', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
      datasets: [
        {
          label: 'Order Value (BDT ×1,000)',
          data: revenues,
          backgroundColor: '#047857',
          borderRadius: 6,
          barPercentage: 0.65
        },
        {
          label: 'Orders Count',
          data: counts,
          backgroundColor: '#10b981',
          borderRadius: 6,
          barPercentage: 0.65
        }
      ]
    }),
    [counts, revenues]
  );

  const options = useMemo<ChartOptions<'bar'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            color: isDark ? '#cbd5e1' : '#475569',
            boxWidth: 10,
            usePointStyle: true,
            font: { size: 11, weight: 600 }
          }
        },
        tooltip: {
          backgroundColor: isDark ? '#0e1b14' : '#0f172a',
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 11 } }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: isDark ? 'rgba(28, 54, 41, 0.5)' : 'rgba(220, 231, 224, 0.7)'
          },
          ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 11 } }
        }
      }
    }),
    [isDark]
  );

  return (
    <div className="h-64 w-full">
      <Bar data={data} options={options} />
    </div>
  );
}

export function CategoryStockBarChart({ products }: { products: ProductItem[] }) {
  const { isDark } = useTheme();

  const { labels, stockUnits, inventoryValues } = useMemo(() => {
    const map = new Map<string, { stock: number; valueK: number }>();
    for (const p of products) {
      if (p.status === 'archived') continue;
      const key = p.category || 'Other';
      const prev = map.get(key) || { stock: 0, valueK: 0 };
      map.set(key, {
        stock: prev.stock + Number(p.quantityAvailable || 0),
        valueK:
          prev.valueK + (Number(p.quantityAvailable || 0) * Number(p.unitPrice || 0)) / 1000
      });
    }
    const entries = Array.from(map.entries());
    return {
      labels: entries.map(([k]) => k),
      stockUnits: entries.map(([, v]) => Math.round(v.stock)),
      inventoryValues: entries.map(([, v]) => Math.round(v.valueK))
    };
  }, [products]);

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: 'Available Stock Units',
          data: stockUnits,
          backgroundColor: '#0284c7',
          borderRadius: 6,
          barPercentage: 0.65
        },
        {
          label: 'Inventory Value (BDT ×1,000)',
          data: inventoryValues,
          backgroundColor: '#15803d',
          borderRadius: 6,
          barPercentage: 0.65
        }
      ]
    }),
    [labels, stockUnits, inventoryValues]
  );

  const options = useMemo<ChartOptions<'bar'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            color: isDark ? '#cbd5e1' : '#475569',
            boxWidth: 10,
            usePointStyle: true,
            font: { size: 11, weight: 600 }
          }
        },
        tooltip: {
          backgroundColor: isDark ? '#0e1b14' : '#0f172a',
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 11 } }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: isDark ? 'rgba(28, 54, 41, 0.5)' : 'rgba(220, 231, 224, 0.7)'
          },
          ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 11 } }
        }
      }
    }),
    [isDark]
  );

  return (
    <div className="h-64 w-full">
      <Bar data={data} options={options} />
    </div>
  );
}
