"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { useCollection } from "@/lib/hooks/useCollection";
import { UserDoc, UserRole } from "@/types";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

const ROLE_LABEL: Record<UserRole, string> = { admin: "관리자", manager: "매니저", partner: "파트너" };

export default function SettingsPage() {
  const { data: users, loading } = useCollection<UserDoc>("users");
  const { isAdmin } = useAuth();

  async function changeRole(uid: string, role: UserRole) {
    await updateDoc(doc(db, "users", uid), { role });
  }

  async function toggleActive(uid: string, active: boolean) {
    await updateDoc(doc(db, "users", uid), { active });
  }

  return (
    <AppShell title="관리자">
      {!isAdmin && (
        <Card className="mb-4 flex items-center gap-3 border-amber-200 bg-amber-50 p-4">
          <ShieldAlert size={18} className="text-amber-600" />
          <p className="text-xs text-amber-700">관리자 권한이 없어 조회만 가능합니다. 계정 변경은 admin 권한이 필요합니다.</p>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>사용자 · 권한 관리</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border bg-surface-muted text-left text-xs text-ink-500">
                <th className="px-5 py-3 font-medium">이름</th>
                <th className="px-5 py-3 font-medium">이메일</th>
                <th className="px-5 py-3 font-medium">권한</th>
                <th className="px-5 py-3 font-medium">담당권역</th>
                <th className="px-5 py-3 font-medium">활성상태</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-surface-border last:border-0">
                  <td className="px-5 py-3 font-medium text-ink-900">{u.name}</td>
                  <td className="px-5 py-3 text-ink-500">{u.email}</td>
                  <td className="px-5 py-3">
                    <select
                      disabled={!isAdmin}
                      value={u.role}
                      onChange={(e) => changeRole(u.id, e.target.value as UserRole)}
                      className="h-8 rounded-md border border-surface-border bg-white px-2 text-xs disabled:bg-surface-muted"
                    >
                      <option value="admin">{ROLE_LABEL.admin}</option>
                      <option value="manager">{ROLE_LABEL.manager}</option>
                      <option value="partner">{ROLE_LABEL.partner}</option>
                    </select>
                  </td>
                  <td className="px-5 py-3 text-ink-500">{u.region ?? "-"}</td>
                  <td className="px-5 py-3">
                    <button
                      disabled={!isAdmin}
                      onClick={() => toggleActive(u.id, !u.active)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        u.active ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {u.active ? "활성" : "비활성"}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-sm text-ink-300">
                    등록된 사용자가 없습니다. Firebase Console에서 계정을 생성한 뒤 users 컬렉션에 문서를 추가하세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </AppShell>
  );
}
