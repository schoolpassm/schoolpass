"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";

export function RegionContractChart({ data }: { data: { region: string; count: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>지역별 계약현황</CardTitle>
      </CardHeader>
      <CardBody className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E9F2" vertical={false} />
            <XAxis dataKey="region" tick={{ fontSize: 12, fill: "#667085" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#667085" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip cursor={{ fill: "#F5F7FB" }} />
            <Bar dataKey="count" name="계약 수" fill="#3B63E0" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardBody>
    </Card>
  );
}

export function MonthlyContractChart({ data }: { data: { month: string; count: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>월별 계약 추이</CardTitle>
      </CardHeader>
      <CardBody className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E9F2" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#667085" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#667085" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip cursor={{ stroke: "#3B63E0", strokeDasharray: "3 3" }} />
            <Line type="monotone" dataKey="count" name="계약 수" stroke="#3B63E0" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardBody>
    </Card>
  );
}
