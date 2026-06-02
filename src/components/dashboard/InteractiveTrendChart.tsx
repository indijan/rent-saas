"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/formatters";

type Point = {
    key: string;
    label: string;
    value: number;
};

type Props = {
    points: Point[];
    gradientId: string;
    currency?: string;
    height?: number;
    width?: number;
};

function buildPolyline(values: number[], width: number, height: number) {
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = Math.max(max - min, 1);

    return values.map((value, index) => {
        const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
        const y = height - ((value - min) / range) * (height - 24) - 12;
        return { x, y, value };
    });
}

export default function InteractiveTrendChart({
    points,
    gradientId,
    currency = "HUF",
    height = 280,
    width = 620,
}: Props) {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const computedPoints = useMemo(() => buildPolyline(points.map((item) => item.value), width, height), [points, width, height]);

    return (
        <div
            className="trend-chart-interactive"
            onPointerLeave={() => setActiveIndex(null)}
            onPointerMove={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const relativeX = ((event.clientX - rect.left) / rect.width) * width;
                const nearestIndex = computedPoints.reduce((bestIndex, point, index) => {
                    if (bestIndex === -1) return index;
                    return Math.abs(point.x - relativeX) < Math.abs(computedPoints[bestIndex].x - relativeX) ? index : bestIndex;
                }, -1);
                setActiveIndex(nearestIndex);
            }}
        >
            <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
                <defs>
                    <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="#1D73FF" />
                        <stop offset="100%" stopColor="#1CD46C" />
                    </linearGradient>
                </defs>
                <path d={`M0 ${height - 30} H${width}`} stroke="rgba(148,163,184,0.22)" strokeWidth="1" />
                <path d={`M0 ${height - 90} H${width}`} stroke="rgba(148,163,184,0.14)" strokeWidth="1" />
                <path d={`M0 ${height - 150} H${width}`} stroke="rgba(148,163,184,0.14)" strokeWidth="1" />
                <path d={`M0 ${height - 210} H${width}`} stroke="rgba(148,163,184,0.14)" strokeWidth="1" />
                <polyline
                    points={computedPoints.map((point) => `${point.x},${point.y}`).join(" ")}
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {activeIndex !== null ? (
                    <>
                        <path d={`M${computedPoints[activeIndex].x} 0 V${height}`} stroke="rgba(37,99,235,0.22)" strokeDasharray="4 4" />
                        <circle cx={computedPoints[activeIndex].x} cy={computedPoints[activeIndex].y} r="6" fill="#ffffff" stroke="#1D73FF" strokeWidth="3" />
                    </>
                ) : null}
            </svg>
            {activeIndex !== null ? (
                <div
                    className="trend-chart-tooltip"
                    style={{
                        left: `${(computedPoints[activeIndex].x / width) * 100}%`,
                        top: `${Math.max(10, (computedPoints[activeIndex].y / height) * 100 - 10)}%`,
                    }}
                >
                    <strong>{points[activeIndex].label}</strong>
                    <span>{formatCurrency(points[activeIndex].value, currency)}</span>
                </div>
            ) : null}
            <div className="trend-chart-labels" style={{ ["--chart-count" as string]: points.length }}>
                {points.map((item) => (
                    <span key={item.key}>{item.label}</span>
                ))}
            </div>
        </div>
    );
}
