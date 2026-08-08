"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { ShieldAlert, RefreshCw, UserPlus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/Input";
import { useCollection } from "@/lib/hooks/useCollection";
import { UserDoc, UserRole } from "@/types";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

const ROLE_LABEL: Record<UserRole, string> = { admin: "관리자", manager: "매니저", partner: "파트너" };

function NewMemberModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { firebaseUser } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "partner" as UserRole, region: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firebaseUser) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "계정 생성 실패");
      setSuccess(`계정 생성 완료! ${form.email} / 비밀번호는 알려주신 임시비밀번호로 로그인 가능합니다.`);
      setForm({ name: "", email: "", password: "", role: "partner", region: "" });
    } catch (e: any) {
      setError(e.message || "오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="새 팀원 계정 추가">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-ink-500">
          여기서 만든 계정으로 팀원이 바로 로그인할 수 있습니다. 임시 비밀번호는 첫 로그인 후 직접 바꾸도록 안내해주세요.
        </p>
        <Field label="이름">
          <Input required value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="이메일 (로그인 아이디)">
          <Input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="임시 비밀번호 (최소 6자)">
          <Input required type="text" value={form.password} onChange={(e) => set("password", e.target.value)} />
        </Field>
        <Field label="권한">
          <Select value={form.role} onChange={(e) => set("role", e.target.value as UserRole)}>
            <option value="partner">파트너 (영업담당)</option>
            <option value="manager">매니저</option>
            <option value="admin">관리자</option>
          </Select>
        </Field>
        <Field label="담당권역 (선택)">
          <Input placeholder="예: 경기도 용인시" value={form.region} onChange={(e) => set("region", e.target.value)} />
        </Field>

        {error && <p className="text-xs text-status-danger">{error}</p>}
        {success && <p className="text-xs text-emerald-600">{success}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            닫기
          </Button>
          <Button type="submit" disabled={saving}>
            <UserPlus size={14} /> {saving ? "생성 중..." : "계정 생성"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function SettingsPage() {
  const { data: users, loading } = useCollection<UserDoc>("users");
  const { isAdmin, firebaseUser } = useAuth();
  const [syncing, setSyncing] = useState<string | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  async function syncClaims(targetUid?: string) {
    if (!firebaseUser) return;
    setSyncing(targetUid ?? "self");
    try {
      const token = await firebaseUser.getIdToken();
      await fetch("/api/users/sync-claims", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(targetUid ? { targetUid } : {}),
      });
      if (!targetUid) {
        // 내 권한을 동기화한 경우, 새 클레임이 실제로 로그인 토큰에 반영되도록 강제 새로고침
        await firebaseUser.getIdToken(true);
        alert("권한 동기화 완료! 대시보드를 새로고침해보세요.");
      }
    } finally {
      setSyncing(null);
    }
  }

  async function changeRole(uid: string, role: UserRole) {
    await updateDoc(doc(db, "users", uid), { role });
    await syncClaims(uid); // Firestore 권한과 로그인 토큰 클레임을 항상 같이 갱신
  }

  async function toggleActive(uid: string, active: boolean) {
    await updateDoc(doc(db, "users", uid), { active });
    await syncClaims(uid);
  }

  return (
    <AppShell title="관리자">
      {!isAdmin && (
        <Card className="mb-4 flex items-center gap-3 border-amber-200 bg-amber-50 p-4">
          <ShieldAlert size={18} className="text-amber-600" />
          <p className="text-xs text-amber-700">관리자 권한이 없어 조회만 가능합니다. 계정 변경은 admin 권한이 필요합니다.</p>
        </Card>
      )}

      <Card className="mb-4 flex items-center justify-between p-4">
        <div>
          <p className="text-sm font-semibold text-ink-900">내 권한 동기화</p>
          <p className="text-xs text-ink-500">
            대시보드 통계가 "권한 없음" 오류로 안 뜨면, 최초 1회 이 버튼을 눌러 로그인 토큰에 권한 정보를 반영하세요.
          </p>
        </div>
        <Button size="sm" onClick={() => syncClaims()} disabled={syncing === "self"}>
          <RefreshCw size={14} className={syncing === "self" ? "animate-spin" : ""} /> 내 권한 동기화
        </Button>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>사용자 · 권한 관리</CardTitle>
          {isAdmin && (
            <Button size="sm" onClick={() => setAddMemberOpen(true)}>
              <UserPlus size={14} /> 새 팀원 추가
            </Button>
          )}
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
                    등록된 사용자가 없습니다. 위 "새 팀원 추가" 버튼으로 계정을 만드세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <NewMemberModal open={addMemberOpen} onClose={() => setAddMemberOpen(false)} />
    </AppShell>
  );
}
