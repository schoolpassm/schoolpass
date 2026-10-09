"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { ShieldAlert, RefreshCw, UserPlus, Lock, Save } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/Input";
import { useCollection } from "@/lib/hooks/useCollection";
import { UserDoc, UserRole, SystemSettingsDoc } from "@/types";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { getSystemSettings, updateSystemSettings } from "@/lib/api/settings";
import { formatDate } from "@/lib/utils";

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

/**
 * ZeroPass 통합 확장(2026.10 지시서 7번) — "보유기간 및 삭제정책", "외부 AI 서비스로
 * 전송되는 데이터 범위에 대한 통제"를 관리자가 문서화·설정할 수 있는 카드.
 * 저장은 settings/system 단일 문서(merge)로 처리하며, 편집은 admin만 가능.
 */
function PrivacySecurityCard({ isAdmin, actorName }: { isAdmin: boolean; actorName: string }) {
  const [settings, setSettings] = useState<SystemSettingsDoc | null>(null);
  const [policyDraft, setPolicyDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSystemSettings().then((s) => {
      setSettings(s);
      setPolicyDraft(s.dataRetentionPolicy ?? "");
    });
  }, []);

  async function savePolicy() {
    setSaving(true);
    setSaved(false);
    try {
      await updateSystemSettings({ dataRetentionPolicy: policyDraft }, actorName);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function toggleScope(key: keyof SystemSettingsDoc["aiDataScope"]) {
    if (!settings) return;
    const next = { ...settings.aiDataScope, [key]: !settings.aiDataScope[key] };
    setSettings({ ...settings, aiDataScope: next });
    await updateSystemSettings({ aiDataScope: next }, actorName);
  }

  if (!settings) {
    return (
      <Card className="mt-4">
        <CardBody>
          <p className="text-xs text-ink-300">불러오는 중...</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-1.5">
            <Lock size={15} className="text-primary-500" /> 개인정보 및 보안
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-5">
        <div>
          <p className="mb-1 text-sm font-semibold text-ink-900">보유기간 및 삭제정책</p>
          <p className="mb-2 text-xs text-ink-500">
            고객(학교/관공서/민간기업) 개인정보·영업정보의 보유기간과 삭제 기준을 여기에 문서화하세요. (예: "계약 종료 후 3년,
            미계약 건은 최종 접촉 2년 후 익명화")
          </p>
          <textarea
            disabled={!isAdmin}
            value={policyDraft}
            onChange={(e) => setPolicyDraft(e.target.value)}
            rows={4}
            placeholder="아직 정책이 입력되지 않았습니다 (검토 필요)"
            className="w-full rounded-lg border border-surface-border bg-white p-3 text-sm disabled:bg-surface-muted"
          />
          {isAdmin && (
            <div className="mt-2 flex items-center gap-2">
              <Button size="sm" onClick={savePolicy} disabled={saving}>
                <Save size={13} /> {saving ? "저장 중..." : "저장"}
              </Button>
              {saved && <span className="text-xs text-emerald-600">저장됨</span>}
            </div>
          )}
          {settings.updatedAt && (
            <p className="mt-1 text-[11px] text-ink-300">
              최종 수정: {formatDate(settings.updatedAt, true)} {settings.updatedByName && `· ${settings.updatedByName}`}
            </p>
          )}
        </div>

        <div className="border-t border-surface-border pt-4">
          <p className="mb-1 text-sm font-semibold text-ink-900">외부 AI(Claude API) 전송 데이터 범위</p>
          <p className="mb-2 text-xs text-ink-500">
            AI 영업도구(전화스크립트·이메일·제안서 등 생성)가 외부 AI 서비스로 보내는 정보 범위를 제한할 수 있습니다. 끄면 해당
            정보는 AI 프롬프트에서 제외됩니다.
          </p>
          <div className="space-y-2">
            {(
              [
                ["includeContactInfo", "담당자 성함·연락처 포함"],
                ["includeBudgetInfo", "예산·계약금액 정보 포함"],
                ["includeNotes", "메모·활동기록 요약 포함"],
              ] as [keyof SystemSettingsDoc["aiDataScope"], string][]
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={settings.aiDataScope[key]}
                  onChange={() => toggleScope(key)}
                  className="h-4 w-4 rounded border-surface-border"
                />
                {label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-amber-600">
            참고: 현재 이 설정은 저장·조회만 지원되며, AI 생성 호출부에 실제로 적용하려면 각 액션별 프롬프트 빌더가 이 설정을
            읽어 필드를 제외하도록 연동이 필요합니다 (후속 작업으로 분리 — 확정된 적용 범위처럼 표시하지 않음).
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

export default function SettingsPage() {
  const { data: users, loading } = useCollection<UserDoc>("users");
  const { isAdmin, firebaseUser, userDoc } = useAuth();
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

      <PrivacySecurityCard isAdmin={isAdmin} actorName={userDoc?.name ?? ""} />
    </AppShell>
  );
}
